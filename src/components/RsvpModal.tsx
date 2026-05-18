import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { format, isToday, isTomorrow, differenceInCalendarDays } from "date-fns";
import { cyaTransition } from "@/lib/motion";
import { activityByName } from "@/data/activities";
import type { DbHangoutSuggestion } from "@/types/database";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function friendlyDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const daysOut = differenceInCalendarDays(d, now);

  let dayLabel: string;
  if (isToday(d)) dayLabel = "Today";
  else if (isTomorrow(d)) dayLabel = "Tomorrow";
  else if (daysOut < 7) dayLabel = `This ${format(d, "EEEE")}`;
  else dayLabel = format(d, "EEEE, MMMM do");

  return dayLabel;
}

function friendlyTime(start: string, end: string): string {
  const fmt = (iso: string) => {
    const s = format(new Date(iso), "h:mmaaa");
    return s.replace(":00", "");
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface RsvpModalProps {
  event: DbHangoutSuggestion;
  /** Whether the current user is in the availability-synced set */
  userIsSynced: boolean;
  currentResponse: "yes" | "no" | "maybe" | "pending";
  onRespond: (response: "yes" | "no" | "maybe") => void;
  onDismiss: () => void;
}

const RsvpModal = ({
  event,
  userIsSynced,
  currentResponse,
  onRespond,
  onDismiss,
}: RsvpModalProps) => {
  const activity = event.suggested_activity
    ? activityByName[event.suggested_activity] ?? null
    : null;
  // activity is kept for potential future use (category, duration info)
  void activity;

  const hasResponded = currentResponse !== "pending";

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="rsvp-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onDismiss}
      />

      {/*
        Sheet — z-[60] sits above BottomNav (z-50).
        Structure: flex column with a scrollable content region and a
        sticky button footer that always clears the bottom nav bar (≈80px).
        max-h-[85dvh] prevents the sheet from consuming the full screen on
        tall content, giving room to see the page behind the backdrop.
      */}
      <motion.div
        key="rsvp-sheet"
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={cyaTransition}
        className="fixed bottom-0 left-0 right-0 z-[60] max-w-lg mx-auto"
      >
        <div className="glass-surface rounded-t-2xl flex flex-col max-h-[85dvh] overflow-hidden">

          {/* ── Scrollable content ─────────────────────────────────────────── */}
          <div className="overflow-y-auto flex-1 p-5 pb-3">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-mono-data text-[10px] text-muted-foreground">
                  HANGOUT PROPOSAL
                </p>
                <h2 className="text-lg text-heading leading-tight">
                  {event.suggested_activity}
                </h2>
              </div>
              <button
                onClick={onDismiss}
                className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center shrink-0"
              >
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>

            {/* Time */}
            {event.start_time && event.end_time && (
              <div className="bg-secondary/60 rounded-lg px-3 py-2.5">
                <p className="text-sm font-medium text-foreground">
                  {friendlyDate(event.start_time)},{" "}
                  {format(new Date(event.start_time), "MMMM do")}
                </p>
                <p className="font-mono-data text-primary mt-0.5">
                  {friendlyTime(event.start_time, event.end_time)}
                </p>
                {userIsSynced && (
                  <p className="text-xs text-accent mt-1">
                    You're free — we checked
                  </p>
                )}
              </div>
            )}

            {/* Show current response label when already responded */}
            {hasResponded && (
              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground">Your response:</p>
                <p className="text-base font-medium text-foreground mt-0.5">
                  {currentResponse === "yes"
                    ? "You're in!"
                    : currentResponse === "no"
                      ? "Can't make it"
                      : "Pick a new activity"}
                </p>
                <p className="font-mono-data text-[10px] text-muted-foreground mt-1">
                  TAP BELOW TO CHANGE YOUR RESPONSE
                </p>
              </div>
            )}
          </div>

          {/*
            ── Sticky action buttons ──────────────────────────────────────────
            flex-shrink-0 keeps buttons visible even when the scroll area is tall.
            pb-[5.5rem] = 88px clears the 80px BottomNav with 8px breathing room.
            The border-top provides a visual separator from the scrolled content.
          */}
          <div className="flex-shrink-0 px-5 pt-3 pb-[5.5rem] border-t border-border/30 bg-background/80 backdrop-blur-sm">
            {!hasResponded ? (
              <div className="space-y-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onRespond("yes")}
                  className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-gloss"
                >
                  I'm in
                </motion.button>
                <div className="flex gap-2">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onRespond("no")}
                    className="flex-1 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium"
                  >
                    Can't make it
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onRespond("maybe")}
                    className="flex-1 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium"
                  >
                    Pick a new activity
                  </motion.button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {(["yes", "no", "maybe"] as const).map((r) => (
                  <motion.button
                    key={r}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onRespond(r)}
                    className={`flex-1 py-2 rounded-md text-xs font-medium transition-all duration-150 ${
                      currentResponse === r
                        ? "bg-primary text-primary-foreground shadow-gloss"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {r === "yes" ? "In" : r === "no" ? "Can't" : "New activity"}
                  </motion.button>
                ))}
              </div>
            )}
          </div>

        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RsvpModal;
