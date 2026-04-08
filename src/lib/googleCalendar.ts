import { addDays, startOfDay } from "date-fns";
import type { BusyInterval, RecurringBlock } from "@/types/calendar";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * Fetch the user's busy blocks for the next 4 weeks via the freebusy endpoint.
 */
export async function fetchFreeBusy(accessToken: string): Promise<BusyInterval[]> {
  const now = new Date();
  const fourWeeksOut = addDays(now, 28);

  const res = await fetch(`${CALENDAR_API}/freeBusy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: now.toISOString(),
      timeMax: fourWeeksOut.toISOString(),
      items: [{ id: "primary" }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Google Calendar API responded with ${res.status}`);
  }

  const data = await res.json();
  const raw: { start: string; end: string }[] =
    data?.calendars?.primary?.busy ?? [];

  return raw.map((b) => ({ start: b.start, end: b.end, source: "google" as const }));
}

// ─── Recurring → concrete intervals ──────────────────────────────────────────

/**
 * Expand weekly recurring blocks into concrete BusyIntervals for the next 4 weeks.
 */
export function expandRecurringBlocks(blocks: RecurringBlock[]): BusyInterval[] {
  const result: BusyInterval[] = [];
  const now = new Date();
  const fourWeeksOut = addDays(now, 28);

  for (let day = startOfDay(now); day <= fourWeeksOut; day = addDays(day, 1)) {
    const dow = day.getDay(); // 0 = Sunday
    for (const block of blocks) {
      if (block.dayOfWeek !== dow) continue;

      const [sh, sm] = block.startTime.split(":").map(Number);
      const [eh, em] = block.endTime.split(":").map(Number);

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

// ─── Interval math ───────────────────────────────────────────────────────────

function mergeIntervals(intervals: BusyInterval[]): BusyInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start.localeCompare(b.start));
  const merged: BusyInterval[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      if (sorted[i].end > last.end) last.end = sorted[i].end;
    } else {
      merged.push({ ...sorted[i] });
    }
  }
  return merged;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Given a user's busy intervals (already includes expanded recurring blocks)
 * and a desired hangout duration, return all free slots over the next 4 weeks.
 *
 * Scanning window defaults to 8 am – 10 pm each day.
 *
 * @example
 * const slots = getAvailableSlots(allBusy, 120); // 2-hour slots
 */
export function getAvailableSlots(
  busyIntervals: BusyInterval[],
  durationMinutes: number,
  options?: { startHour?: number; endHour?: number }
): { start: string; end: string }[] {
  const startHour = options?.startHour ?? 8;
  const endHour = options?.endHour ?? 22;
  const durationMs = durationMinutes * 60_000;

  const merged = mergeIntervals(busyIntervals);
  const result: { start: string; end: string }[] = [];

  const now = new Date();
  const fourWeeksOut = addDays(now, 28);

  for (let day = startOfDay(now); day <= fourWeeksOut; day = addDays(day, 1)) {
    const windowStart = new Date(day);
    windowStart.setHours(startHour, 0, 0, 0);
    const windowEnd = new Date(day);
    windowEnd.setHours(endHour, 0, 0, 0);

    // Cursor: the later of windowStart and now, snapped up to the next 30-min boundary
    let cursor = new Date(Math.max(windowStart.getTime(), now.getTime()));
    const m = cursor.getMinutes();
    if (m !== 0 && m !== 30) {
      cursor.setMinutes(m < 30 ? 30 : 60, 0, 0);
    } else {
      cursor.setSeconds(0, 0);
    }

    if (cursor >= windowEnd) continue;

    // Busy blocks that overlap today's window
    const dayBusy = merged.filter(
      (b) => new Date(b.end) > windowStart && new Date(b.start) < windowEnd
    );

    for (const busy of dayBusy) {
      const bStart = new Date(busy.start);
      const bEnd = new Date(busy.end);

      // Free gap before this busy block
      const gapEnd = bStart < windowEnd ? bStart : windowEnd;
      if (gapEnd > cursor && gapEnd.getTime() - cursor.getTime() >= durationMs) {
        result.push({ start: cursor.toISOString(), end: gapEnd.toISOString() });
      }

      if (bEnd > cursor) cursor = new Date(bEnd);
    }

    // Free gap at end of day window
    if (windowEnd > cursor && windowEnd.getTime() - cursor.getTime() >= durationMs) {
      result.push({ start: cursor.toISOString(), end: windowEnd.toISOString() });
    }
  }

  return result;
}
