import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { differenceInSeconds, format } from "date-fns";
import { cyaTransition } from "@/lib/motion";
import { activityById, CATEGORY_EMOJI } from "@/data/activities";
import type { DbHangoutSuggestion, DbHangoutVote } from "@/types/database";

// ─── Countdown timer ──────────────────────────────────────────────────────────

function useCountdown(expiresAt: string | null): string {
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const secs = differenceInSeconds(new Date(expiresAt), new Date());
      if (secs <= 0) {
        setLabel("Voting closed");
        return;
      }
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      setLabel(
        h > 0
          ? `${h}h ${m}m remaining`
          : m > 0
            ? `${m}m ${s}s remaining`
            : `${s}s remaining`,
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return label;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface VoteModalProps {
  event: DbHangoutSuggestion;
  votes: DbHangoutVote[];
  currentUserId: string;
  myVote: string | null; // activity_id the current user voted for, or null
  onVote: (activityId: string) => void;
  onDismiss: () => void;
}

const VoteModal = ({
  event,
  votes,
  currentUserId,
  myVote,
  onVote,
  onDismiss,
}: VoteModalProps) => {
  const countdown = useCountdown(event.vote_expires_at ?? null);
  const opts = event.vote_options;
  if (!opts) return null;

  const options = [opts.originalId, opts.alt1Id, opts.alt2Id].filter(
    Boolean,
  ) as string[];

  const voteCounts = options.reduce<Record<string, number>>((acc, id) => {
    acc[id] = votes.filter((v) => v.activity_id === id).length;
    return acc;
  }, {});

  const totalVotes = votes.length;
  const hasVoted = myVote !== null;

  // Find closing date label
  const closingLabel = event.vote_expires_at
    ? format(new Date(event.vote_expires_at), "MMM d 'at' h:mmaaa")
    : null;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="vote-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onDismiss}
      />

      {/* Sheet */}
      <motion.div
        key="vote-sheet"
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={cyaTransition}
        className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto"
      >
        <div className="glass-surface rounded-t-2xl p-5 pb-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="font-mono-data text-[10px] text-muted-foreground">
                ACTIVITY VOTE 🗳️
              </p>
              <h2 className="text-base font-medium text-foreground leading-snug">
                Someone doesn't vibe — let's take a vote!
              </h2>
            </div>
            <button
              onClick={onDismiss}
              className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center ml-2 shrink-0"
            >
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>

          {/* Countdown */}
          <p className="font-mono-data text-[10px] text-primary mb-4">
            {closingLabel
              ? `CLOSES ${closingLabel.toUpperCase()} · ${countdown.toUpperCase()}`
              : countdown.toUpperCase()}
          </p>

          {/* Options */}
          <div className="space-y-2 mb-4">
            {options.map((id, idx) => {
              const act = activityById[id];
              if (!act) return null;
              const count = voteCounts[id] ?? 0;
              const pct = totalVotes > 0 ? count / totalVotes : 0;
              const isChosen = myVote === id;
              const isOriginal = idx === 0;

              return (
                <motion.button
                  key={id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onVote(id)}
                  className={`w-full rounded-lg p-3 text-left transition-all duration-150 relative overflow-hidden ${
                    isChosen
                      ? "ring-2 ring-primary bg-primary/5"
                      : "glass-surface hover:shadow-gloss-hover"
                  }`}
                >
                  {/* Vote bar background */}
                  {hasVoted && (
                    <div
                      className="absolute inset-y-0 left-0 bg-primary/10 rounded-lg transition-all duration-500"
                      style={{ width: `${pct * 100}%` }}
                    />
                  )}
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {CATEGORY_EMOJI[act.category]}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {act.name}
                          {isOriginal && (
                            <span className="ml-1.5 font-mono-data text-[9px] text-muted-foreground">
                              ORIGINAL
                            </span>
                          )}
                        </p>
                        <p className="font-mono-data text-[10px] text-muted-foreground">
                          {act.category}
                        </p>
                      </div>
                    </div>
                    {hasVoted && (
                      <span className="font-mono-data text-xs text-primary ml-2 shrink-0">
                        {count} vote{count !== 1 ? "s" : ""}
                      </span>
                    )}
                    {isChosen && (
                      <span className="font-mono-data text-[10px] text-primary ml-2 shrink-0">
                        ✓ YOUR PICK
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>

          <p className="text-body text-xs text-center text-muted-foreground">
            {hasVoted
              ? "Tap another option to change your vote."
              : "Pick the activity you'd prefer."}
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VoteModal;
