// ─── Activity suggestion engine ───────────────────────────────────────────────
// Pure utility — no UI imports, no side effects, fully testable in isolation.

import { activities, type Activity } from "@/data/activities";

const TOTAL_BUFFER = 50; // 25 min each end
const WINTER_MONTHS = new Set([11, 12, 1, 2, 3]); // Nov–Mar

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Score how well an activity fills a slot.
 * Tent function peaking at 72.5% fill (midpoint of the ideal 60–85% range).
 * Activities below 40% or above 95% fill receive the floor score (0.05).
 */
function scoreFill(fill: number): number {
  if (fill < 0.4 || fill > 0.95) return 0.05;
  const dist = Math.abs(fill - 0.725);
  return Math.max(0.05, 1 - dist * 2.5);
}

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Given a group's selected activity IDs, a free time slot, and the current
 * month, returns the single best-fit activity suggestion (or null if nothing
 * passes all filters).
 *
 * Filter order:
 *  1. Category  — only activities in groupInterestIds
 *  2. Seasonal  — exclude april-october activities in Nov–Mar
 *  3. Duration  — slot ≥ minFreeTimeMinutes (or minDuration + 50)
 *  4. Time window — midpoint duration + buffer fits within slot ∩ timeWindow
 *  5. Repeat   — skip lastSuggestedId unless fewer than 4 eligible remain
 *
 * Scoring: prefer activities whose (midDuration + 50) fills 60–85% of the slot.
 */
export function suggestActivity(
  groupInterestIds: string[],
  slot: { start: string; end: string },
  currentMonth: number, // 1–12
  lastSuggestedId?: string | null,
): Activity | null {
  const slotStart = new Date(slot.start);
  const slotEnd = new Date(slot.end);
  const slotDurationMinutes =
    (slotEnd.getTime() - slotStart.getTime()) / 60_000;

  // Fractional-hour position of the slot within the day
  const slotStartHour = slotStart.getHours() + slotStart.getMinutes() / 60;
  const slotEndHour = Math.min(
    slotEnd.getHours() + slotEnd.getMinutes() / 60,
    24,
  );

  const isWinter = WINTER_MONTHS.has(currentMonth);

  // ── Filter 1: category ───────────────────────────────────────────────────
  let eligible = activities.filter((a) => groupInterestIds.includes(a.id));

  // ── Filter 2: seasonal ───────────────────────────────────────────────────
  eligible = eligible.filter(
    (a) => !(a.seasonalRestriction === "april-october" && isWinter),
  );

  // ── Filter 3: duration ───────────────────────────────────────────────────
  // Use minFreeTimeMinutes when set (Sports/Adventure), else minDuration + buffer.
  eligible = eligible.filter((a) => {
    const required = a.minFreeTimeMinutes ?? a.minDuration + TOTAL_BUFFER;
    return slotDurationMinutes >= required;
  });

  // ── Filter 4: time window ────────────────────────────────────────────────
  // The activity's mid-duration + buffer must fit within the overlap of the
  // free slot and the activity's allowed time window.
  eligible = eligible.filter((a) => {
    const midDuration = (a.minDuration + a.maxDuration) / 2;
    const totalActivityTime = midDuration + TOTAL_BUFFER;

    const overlapStart = Math.max(slotStartHour, a.timeWindow.start);
    const overlapEnd = Math.min(slotEndHour, a.timeWindow.end);
    const overlapMinutes = (overlapEnd - overlapStart) * 60;

    return overlapMinutes >= totalActivityTime;
  });

  // ── Filter 5: repeat ─────────────────────────────────────────────────────
  if (lastSuggestedId && eligible.length >= 4) {
    eligible = eligible.filter((a) => a.id !== lastSuggestedId);
  }

  if (eligible.length === 0) return null;

  // ── Score & pick ─────────────────────────────────────────────────────────
  let best: Activity = eligible[0];
  let bestScore = -Infinity;

  for (const a of eligible) {
    const midDuration = (a.minDuration + a.maxDuration) / 2;
    const fill = (midDuration + TOTAL_BUFFER) / slotDurationMinutes;
    const score = scoreFill(fill);
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }

  return best;
}
