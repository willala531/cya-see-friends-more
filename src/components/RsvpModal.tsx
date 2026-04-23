import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { format, isToday, isTomorrow, differenceInCalendarDays } from "date-fns";
import { cyaTransition } from "@/lib/motion";
import { CATEGORY_EMOJI, activityByName } from "@/data/activities";
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
  const emoji = activity ? CATEGORY_EMOJI[activity.category] : "🗓️";

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

      {/* Sheet */}
      <motion.div
        key="rsvp-sheet"
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={cyaTransition}
        className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto"
      >
        <div className="glass-surface rounded-t-2xl p-5 pb-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{emoji}</span>
              <div>
                <p className="font-mono-data text-[10px] text-muted-foreground">
                  HANGOUT PROPOSAL
                </p>
                <h2 className="text-lg text-heading leading-tight">
                  {event.suggested_activity}
                </h2>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center"
            >
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>

          {/* Time */}
          {event.start_time && event.end_time && (
            <div className="bg-secondary/60 rounded-lg px-3 py-2.5 mb-4">
              <p className="text-sm font-medium text-foreground">
                {friendlyDate(event.start_time)},{" "}
                {format(new Date(event.start_time), "MMMM do")}
              </p>
              <p className="font-mono-data text-primary mt-0.5">
                {friendlyTime(event.start_time, event.end_time)}
              </p>
              {userIsSynced && (
                <p className="text-xs text-accent mt-1">
                  You're free — we checked ✓
                </p>
              )}
            </div>
          )}

          {/* Response buttons or current response */}
          {!hasResponded ? (
            <div className="space-y-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => onRespond("yes")}
                className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-gloss"
              >
                🙌 I'm in
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
                  😐 Not vibing
                </motion.button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground">Your response:</p>
                <p className="text-base font-medium text-foreground mt-0.5">
                  {currentResponse === "yes"
                    ? "🙌 You're in!"
                    : currentResponse === "no"
                      ? "Can't make it"
                      : "😐 Not vibing"}
                </p>
              </div>
              <p className="font-mono-data text-[10px] text-muted-foreground text-center">
                TAP BELOW TO CHANGE YOUR RESPONSE
              </p>
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
                    {r === "yes" ? "🙌 In" : r === "no" ? "Can't" : "😐 Meh"}
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RsvpModal;
