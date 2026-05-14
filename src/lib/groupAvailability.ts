import { addDays, startOfDay, isToday, isTomorrow, differenceInCalendarDays, format } from "date-fns";
import { expandRecurringBlocks, getAvailableSlots } from "@/lib/googleCalendar";
import type { BusyInterval, RecurringBlock } from "@/types/calendar";
import type { DbAvailabilityBlock } from "@/types/database";

// ─── WeekSchedule types (mirror of AvailabilityPage local types) ──────────────
// These match exactly what is written to localStorage("cya-availability").

interface TimeBlock {
  id: string;
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

interface DaySchedule {
  enabled: boolean;
  blocks: TimeBlock[];
}

type WeekSchedule = Record<string, DaySchedule>;

const DAY_NAME_TO_DOW: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_HANGOUT_DURATION = 180; // 3 hours in minutes

// ─── Expand WeekSchedule → BusyInterval[] ────────────────────────────────────

/**
 * Converts the user's weekly availability schedule from AvailabilityPage
 * (stored in localStorage as "cya-availability") into concrete BusyIntervals
 * for the next 4 weeks. Each enabled day's time blocks represent busy periods.
 */
export function expandWeekSchedule(schedule: WeekSchedule): BusyInterval[] {
  const result: BusyInterval[] = [];
  const now = new Date();
  const fourWeeksOut = addDays(now, 28);

  for (let day = startOfDay(now); day <= fourWeeksOut; day = addDays(day, 1)) {
    const dow = day.getDay();
    const dayName = Object.entries(DAY_NAME_TO_DOW).find(([, d]) => d === dow)?.[0];
    if (!dayName) continue;

    const daySchedule = schedule[dayName];
    if (!daySchedule?.enabled) continue;

    for (const block of daySchedule.blocks) {
      const [sh, sm] = block.start.split(":").map(Number);
      const [eh, em] = block.end.split(":").map(Number);

      const start = new Date(day);
      start.setHours(sh, sm, 0, 0);
      const end = new Date(day);
      end.setHours(eh, em, 0, 0);

      if (end > start && end > now) {
        result.push({ start: start.toISOString(), end: end.toISOString(), source: "manual" });
      }
    }
  }

  return result;
}

// ─── Merge all busy sources for a single user ────────────────────────────────

/**
 * Combines a user's three sources of busy time into one merged array:
 *  1. googleBusyIntervals — raw intervals fetched from Google Calendar
 *  2. manualBlocks — recurring blocks from the calendar context
 *  3. weekSchedule — the weekly availability schedule from AvailabilityPage
 *
 * Overlapping intervals are merged so there are no duplicates.
 */
export function mergeAllUserBusy(
  googleBusyIntervals: BusyInterval[],
  manualBlocks: RecurringBlock[],
  weekSchedule: WeekSchedule | null,
): BusyInterval[] {
  const expanded = expandRecurringBlocks(manualBlocks);
  const weekly = weekSchedule ? expandWeekSchedule(weekSchedule) : [];
  // getAvailableSlots handles merging internally; we just need a combined list
  // Combine all three, return as-is (getAvailableSlots / findGroupAvailability
  // will merge when computing free slots).
  return [...googleBusyIntervals, ...expanded, ...weekly];
}

// ─── Group availability matching ─────────────────────────────────────────────

export interface MemberAvailability {
  name: string;
  busyIntervals: BusyInterval[];
}

/**
 * Given an array of members (each with their combined busy intervals) and a
 * desired hangout duration, returns all time windows over the next 4 weeks
 * where every member is simultaneously free for the full duration.
 *
 * Windows are bounded to 8am–10pm each day and sorted chronologically.
 */
export function findGroupAvailability(
  members: MemberAvailability[],
  durationMinutes: number,
): { start: string; end: string }[] {
  if (members.length === 0) return [];

  // Union of all members' busy time = any slot where anyone is busy is blocked
  const combinedBusy: BusyInterval[] = members.flatMap((m) => m.busyIntervals);

  // getAvailableSlots merges overlapping intervals internally and scans 8am–10pm
  return getAvailableSlots(combinedBusy, durationMinutes);
}

/**
 * Returns the single soonest window where all members are free for
 * durationMinutes, or null if none exists in the next 4 weeks.
 *
 * Enforces a minimum 24-hour lead time: slots starting within the next
 * 24 hours are excluded so the app never suggests a same-day hangout
 * that users can't realistically prepare for.
 */
export function getNearestSlot(
  members: MemberAvailability[],
  durationMinutes: number,
): { start: string; end: string } | null {
  const slots = findGroupAvailability(members, durationMinutes);
  const earliestAllowed = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const validSlots = slots.filter((s) => new Date(s.start) >= earliestAllowed);
  return validSlots.length > 0 ? validSlots[0] : null;
}

// ─── Supabase → BusyInterval bridge ──────────────────────────────────────────

/**
 * Converts a user's DbAvailabilityBlock[] rows (fetched from Supabase) into a
 * unified BusyInterval[] ready for the matching algorithm.
 *
 * Three block types are handled:
 *   source="google",   is_recurring=false  → concrete timestamp interval
 *   source="manual",   is_recurring=true   → RecurringBlock stored in recurrence_rule,
 *                                            expanded via expandRecurringBlocks()
 *   source="schedule", is_recurring=true   → WeekSchedule stored in recurrence_rule,
 *                                            expanded via expandWeekSchedule()
 */
export function blocksToUserBusy(blocks: DbAvailabilityBlock[]): BusyInterval[] {
  const result: BusyInterval[] = [];

  for (const block of blocks) {
    if (!block.is_recurring) {
      // Concrete Google Calendar interval
      if (block.start_time && block.end_time) {
        result.push({ start: block.start_time, end: block.end_time, source: "google" });
      }
    } else if (block.source === "manual" && block.recurrence_rule) {
      // Manual recurring block — recurrence_rule holds Omit<RecurringBlock, "id">
      const rb = block.recurrence_rule as unknown as Omit<RecurringBlock, "id">;
      result.push(...expandRecurringBlocks([{ ...rb, id: block.id }]));
    } else if (block.source === "schedule" && block.recurrence_rule) {
      // Weekly schedule — recurrence_rule holds a WeekSchedule object
      result.push(...expandWeekSchedule(block.recurrence_rule as WeekSchedule));
    }
  }

  return result;
}

// ─── Display formatting ───────────────────────────────────────────────────────

/**
 * Formats a nearest slot into a human-readable sentence, e.g.:
 *   "Everyone is free today from 2pm – 5pm"
 *   "Everyone is free this Saturday from 11am – 2pm"
 *   "Everyone is free on Saturday, Apr 19 from 2pm – 6pm"
 *
 * Returns a "no availability" message when slot is null.
 */
export function formatNearestSlot(slot: { start: string; end: string } | null): string {
  if (!slot) return "No availability found in the next 4 weeks";

  const start = new Date(slot.start);
  const end = new Date(slot.end);
  const now = new Date();

  let dayLabel: string;
  const daysOut = differenceInCalendarDays(start, now);

  if (isToday(start)) {
    dayLabel = "today";
  } else if (isTomorrow(start)) {
    dayLabel = "tomorrow";
  } else if (daysOut < 7) {
    dayLabel = `this ${format(start, "EEEE")}`;
  } else {
    dayLabel = `on ${format(start, "EEEE, MMM d")}`;
  }

  // Format times: "2pm", "2:30pm" (strip :00 for clean display)
  const fmt = (d: Date) => {
    const s = format(d, "h:mmaaa"); // e.g. "2:00pm"
    return s.replace(":00", "");    // → "2pm" or "2:30pm"
  };

  return `Everyone is free ${dayLabel} from ${fmt(start)} – ${fmt(end)}`;
}
