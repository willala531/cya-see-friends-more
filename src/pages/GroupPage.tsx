import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Link2, Clock, AlertTriangle, CalendarCheck, UserPlus, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cyaTransition } from "@/lib/motion";
import { useAuth } from "@/contexts/AuthContext";
import { useGroup, useUpdateLastSuggested, useUpdateCanInvite } from "@/hooks/useGroups";
import {
  useGroupEvents,
  useUpdateRsvp,
  useCreateHangoutSuggestion,
  useHangoutVotes,
  useCastVote,
} from "@/hooks/useEvents";
import { useGroupAvailabilityBlocks } from "@/hooks/useAvailability";
import { useRsvpDecision } from "@/hooks/useRsvpDecision";
import {
  blocksToUserBusy,
  getNearestSlot,
  formatNearestSlot,
  DEFAULT_HANGOUT_DURATION,
} from "@/lib/groupAvailability";
import { suggestActivity } from "@/utils/suggestionEngine";
import { CATEGORY_EMOJI } from "@/data/activities";
import GroupInterests from "@/components/GroupInterests";
import RsvpModal from "@/components/RsvpModal";
import VoteModal from "@/components/VoteModal";
import ConfettiOverlay from "@/components/ConfettiOverlay";
import InviteModal from "@/components/InviteModal";

// ─── Pending event the current user hasn't answered yet ───────────────────────

function useFirstUnansweredEvent(
  events: ReturnType<typeof useGroupEvents>["data"],
  userId: string | undefined,
) {
  return useMemo(() => {
    if (!events || !userId) return null;
    return (
      events.find(
        (e) =>
          e.status === "pending" &&
          (e.rsvps?.find((r) => r.user_id === userId)?.response ?? "pending") ===
            "pending",
      ) ?? null
    );
  }, [events, userId]);
}

// ─── Event card helpers ────────────────────────────────────────────────────────

function EventDate({
  startTime,
  endTime,
  yesCount,
  total,
}: {
  startTime: string;
  endTime: string | null;
  yesCount: number;
  total: number;
}) {
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : null;
  return (
    <div className="bg-secondary/50 rounded-md p-3 mb-4">
      <p className="font-mono-data text-foreground text-sm">
        {start.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        })}
      </p>
      <p className="font-mono-data text-primary mt-1">
        {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        {end && (
          <>
            {" "}–{" "}
            {end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </>
        )}
      </p>
      <p className="font-mono-data text-muted-foreground text-[11px] mt-1">
        {yesCount}/{total} members free.{" "}
        {yesCount >= Math.ceil(total / 2)
          ? "Majority reached."
          : `Need ${Math.ceil(total / 2) - yesCount} more.`}
      </p>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

const GroupPage = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const { data: group, isLoading: groupLoading } = useGroup(groupId);
  const { data: events = [], isLoading: eventsLoading } = useGroupEvents(groupId);
  const { data: allBlocks = [] } = useGroupAvailabilityBlocks(groupId);
  const updateRsvp = useUpdateRsvp();
  const createSuggestion = useCreateHangoutSuggestion();
  const updateLastSuggested = useUpdateLastSuggested();
  const updateCanInvite = useUpdateCanInvite();
  const castVote = useCastVote();

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Optimistic RSVP state
  const [rsvpStates, setRsvpStates] = useState<
    Record<string, "yes" | "no" | "maybe" | "pending">
  >({});

  // Modal visibility
  const [showRsvpModal, setShowRsvpModal] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Vote modal — keyed to the first event in vote mode
  const voteEvent = useMemo(
    () => events.find((e) => e.status === "pending" && e.vote_options != null) ?? null,
    [events],
  );
  const [showVoteModal, setShowVoteModal] = useState(false);
  const { data: votes = [] } = useHangoutVotes(voteEvent?.id);
  const myVote = useMemo(
    () => votes.find((v) => v.user_id === user?.id)?.activity_id ?? null,
    [votes, user],
  );

  // Session-dismissed RSVP modal keys
  const dismissedRef = useRef(new Set<string>());

  // Welcome toast when arriving via invite acceptance
  const welcomeShownRef = useRef(false);
  useEffect(() => {
    const welcomeGroup = searchParams.get("welcome");
    if (welcomeGroup && !welcomeShownRef.current) {
      welcomeShownRef.current = true;
      toast.success(`Welcome to ${welcomeGroup}! 🎉`);
    }
  }, [searchParams]);

  // ── Synced members ────────────────────────────────────────────────────────
  const syncedUserIds = useMemo(
    () => new Set(allBlocks.map((b) => b.user_id)),
    [allBlocks],
  );

  // ── Invite permissions ─────────────────────────────────────────────────────
  const myMember = useMemo(
    () => group?.group_members.find((m) => m.user_id === user?.id),
    [group, user],
  );
  const isCreator = group?.created_by === user?.id;
  const canInvite = myMember?.can_invite ?? false;

  // ── Nearest slot ─────────────────────────────────────────────────────────
  const nearestSlot = useMemo(() => {
    if (!group || allBlocks.length === 0) return null;
    const membersBusy = group.group_members.map((member) => ({
      name: member.users?.display_name ?? "Unknown",
      busyIntervals: blocksToUserBusy(
        allBlocks.filter((b) => b.user_id === member.user_id),
      ),
    }));
    return getNearestSlot(membersBusy, DEFAULT_HANGOUT_DURATION);
  }, [group, allBlocks]);

  // ── Suggestion engine ─────────────────────────────────────────────────────
  const suggestion = useMemo(() => {
    if (!nearestSlot || !group?.group_interests?.length) return null;
    return suggestActivity(
      group.group_interests,
      nearestSlot,
      new Date().getMonth() + 1,
      group.last_suggested_activity_id,
    );
  }, [nearestSlot, group?.group_interests, group?.last_suggested_activity_id]);

  // ── Auto-save suggestion ──────────────────────────────────────────────────
  const savedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!suggestion || !nearestSlot || !group || eventsLoading) return;

    // Guard 1: don't create while any suggestion is still pending RSVP.
    // One active proposal per group at a time.
    const hasPending = events.some((e) => e.status === "pending");
    if (hasPending) return;

    // Guard 2: don't create while a confirmed hangout is still in the future.
    // Wait until after that hangout's date before generating the next one.
    const now = new Date();
    const hasFutureConfirmed = events.some(
      (e) => e.status === "confirmed" && e.start_time && new Date(e.start_time) > now,
    );
    if (hasFutureConfirmed) return;

    const key = `${nearestSlot.start}::${suggestion.id}`;
    if (savedKeyRef.current === key) return;

    const alreadySaved = events.some(
      (e) =>
        e.suggested_activity === suggestion.name &&
        e.start_time &&
        Math.abs(
          new Date(e.start_time).getTime() - new Date(nearestSlot.start).getTime(),
        ) <
          60 * 60 * 1000,
    );

    if (alreadySaved) {
      savedKeyRef.current = key;
      return;
    }

    savedKeyRef.current = key;
    createSuggestion.mutate(
      {
        group_id: group.id,
        suggested_activity: suggestion.name,
        start_time: nearestSlot.start,
        end_time: nearestSlot.end,
      },
      {
        onSuccess: () => {
          updateLastSuggested.mutate({ groupId: group.id, activityId: suggestion.id });
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion?.id, nearestSlot?.start, eventsLoading, events.length]);

  // ── RSVP decision engine ──────────────────────────────────────────────────
  const { showConfetti: decisionConfetti } = useRsvpDecision({
    groupId,
    group,
    events,
    currentUserId: user?.id,
  });

  useEffect(() => {
    if (decisionConfetti) setShowConfetti(true);
  }, [decisionConfetti]);

  // ── RSVP modal auto-show ──────────────────────────────────────────────────
  const firstUnanswered = useFirstUnansweredEvent(events, user?.id);

  useEffect(() => {
    if (!firstUnanswered) return;
    if (dismissedRef.current.has(firstUnanswered.id)) return;
    // Small delay so the page has a chance to render first
    const t = setTimeout(() => setShowRsvpModal(true), 400);
    return () => clearTimeout(t);
  }, [firstUnanswered?.id]);

  // ── Vote modal auto-show ──────────────────────────────────────────────────
  useEffect(() => {
    if (voteEvent && myVote === null) {
      const t = setTimeout(() => setShowVoteModal(true), 600);
      return () => clearTimeout(t);
    }
  }, [voteEvent?.id, myVote]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  // handleDismissRsvp must live here — BEFORE the early return — because
  // useCallback is a hook and hooks must be called unconditionally on every
  // render. Calling it after `if (groupLoading || !group) return` would mean
  // it is skipped on the loading render and called on the data render, which
  // changes the hook count between renders and throws React error #310.
  const handleDismissRsvp = useCallback(() => {
    if (firstUnanswered) dismissedRef.current.add(firstUnanswered.id);
    setShowRsvpModal(false);
  }, [firstUnanswered]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (groupLoading || !group) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">
          {groupLoading ? "Loading…" : "Group not found"}
        </p>
      </div>
    );
  }

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(`https://cya.app/join/${group.invite_code}`);
    toast.success("Invite link copied!");
  };

  const handleRsvp = (hangoutId: string, response: "yes" | "no" | "maybe") => {
    setRsvpStates((prev) => ({ ...prev, [hangoutId]: response }));
    updateRsvp.mutate(
      { hangoutId, groupId: group.id, response },
      {
        onSuccess: () => {
          if (response === "yes") toast.success("You're in! 🙌");
          else if (response === "no") toast.success("Maybe next time");
          else toast("Got it — we'll check for alternatives");
          setShowRsvpModal(false);
        },
        onError: () => {
          setRsvpStates((prev) => {
            const next = { ...prev };
            delete next[hangoutId];
            return next;
          });
          toast.error("Failed to update RSVP");
        },
      },
    );
  };

  const handleVote = (activityId: string) => {
    if (!voteEvent) return;
    castVote.mutate(
      { hangoutId: voteEvent.id, activityId },
      { onSuccess: () => toast("Vote recorded!") },
    );
  };

  return (
    <>
      {/* Confetti */}
      {showConfetti && (
        <ConfettiOverlay onDone={() => setShowConfetti(false)} />
      )}

      {/* Invite modal */}
      <AnimatePresence>
        {showInviteModal && (
          <InviteModal
            groupId={group.id}
            onDismiss={() => setShowInviteModal(false)}
          />
        )}
      </AnimatePresence>

      {/* RSVP modal */}
      {showRsvpModal && firstUnanswered && (
        <RsvpModal
          event={firstUnanswered}
          userIsSynced={syncedUserIds.has(user?.id ?? "")}
          currentResponse={
            rsvpStates[firstUnanswered.id] ??
            (firstUnanswered.rsvps?.find((r) => r.user_id === user?.id)
              ?.response as "yes" | "no" | "maybe" | "pending") ??
            "pending"
          }
          onRespond={(r) => handleRsvp(firstUnanswered.id, r)}
          onDismiss={handleDismissRsvp}
        />
      )}

      {/* Vote modal */}
      {showVoteModal && voteEvent && (
        <VoteModal
          event={voteEvent}
          votes={votes}
          currentUserId={user?.id ?? ""}
          myVote={myVote}
          onVote={handleVote}
          onDismiss={() => setShowVoteModal(false)}
        />
      )}

      <div className="pb-24 px-4 pt-6 max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center hover:shadow-gloss-hover transition-shadow"
          >
            <ArrowLeft size={16} className="text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg text-heading">{group.name}</h1>
            <p className="font-mono-data text-muted-foreground text-[11px]">
              {group.group_members.length} members
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canInvite && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-xs font-medium text-primary-foreground shadow-gloss"
              >
                <UserPlus size={12} />
                Invite
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleCopyInvite}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-xs font-medium text-secondary-foreground hover:shadow-gloss-hover transition-shadow"
            >
              <Link2 size={12} />
              link
            </motion.button>
          </div>
        </div>

        {/* Next shared window + suggestion */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={cyaTransition}
          className="mb-6"
        >
          <h2 className="font-mono-data text-muted-foreground mb-2">Next window</h2>
          <div className="glass-surface rounded-lg p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <CalendarCheck size={15} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground leading-snug">
                {formatNearestSlot(nearestSlot)}
              </p>
              {nearestSlot && (
                <p className="text-sm text-foreground mt-1">
                  {suggestion
                    ? `How about ${suggestion.name.toLowerCase()}? ${CATEGORY_EMOJI[suggestion.category]}`
                    : group.group_interests.length === 0
                      ? "Add group interests below to get a suggestion."
                      : "No matching activities for this window."}
                </p>
              )}
              <p className="font-mono-data text-[10px] text-muted-foreground mt-1.5 uppercase">
                {syncedUserIds.size}/{group.group_members.length} members synced ·{" "}
                {DEFAULT_HANGOUT_DURATION / 60}h window
              </p>
            </div>
          </div>
        </motion.section>

        {/* Events */}
        {events.map((event, i) => {
          const date = event.start_time ? new Date(event.start_time) : null;
          const endDate = event.end_time ? new Date(event.end_time) : null;
          const rsvps = event.rsvps ?? [];
          const yesCount = rsvps.filter((r) => r.response === "yes").length;
          const currentRsvp =
            rsvpStates[event.id] ??
            (rsvps.find((r) => r.user_id === user?.id)?.response as
              | "yes"
              | "no"
              | "maybe"
              | "pending"
              | undefined) ??
            "pending";

          const isVoteActive =
            event.status === "pending" && event.vote_options != null;

          return (
            <motion.section
              key={event.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...cyaTransition, delay: i * 0.08 }}
              className="mb-6"
            >
              <h2 className="font-mono-data text-muted-foreground mb-3">
                {event.status === "confirmed"
                  ? "Upcoming"
                  : isVoteActive
                    ? "Vote in progress"
                    : "Proposal"}
              </h2>
              <div
                className={`glass-surface rounded-lg p-5 ${
                  event.status === "confirmed"
                    ? "border-l-2 border-l-accent"
                    : isVoteActive
                      ? "border-l-2 border-l-primary"
                      : ""
                }`}
              >
                {/* Title + badge */}
                <div className="flex items-start justify-between mb-4">
                  <p className="text-base font-medium text-foreground">
                    {event.suggested_activity}
                  </p>
                  {event.status === "confirmed" && (
                    <span className="font-mono-data text-[10px] text-accent px-2 py-0.5 rounded-sm bg-accent/10">
                      confirmed
                    </span>
                  )}
                  {isVoteActive && (
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setShowVoteModal(true)}
                      className="font-mono-data text-[10px] text-primary px-2 py-0.5 rounded-sm bg-primary/10"
                    >
                      🗳️ vote
                    </motion.button>
                  )}
                </div>

                {/* Date/time block */}
                {date && (
                  <EventDate
                    startTime={event.start_time!}
                    endTime={event.end_time}
                    yesCount={yesCount}
                    total={rsvps.length}
                  />
                )}

                {/* RSVP buttons — pending events only */}
                {event.status === "pending" && (
                  <div className="flex gap-2 mb-4">
                    {(["yes", "no", "maybe"] as const).map((r) => {
                      const labels = {
                        yes: "🙌 I'm in",
                        no: "Can't make it",
                        maybe: "😐 Not vibing",
                      };
                      const activeClass =
                        r === "yes"
                          ? "bg-primary text-primary-foreground shadow-gloss"
                          : r === "no"
                            ? "bg-destructive text-destructive-foreground shadow-gloss"
                            : "bg-secondary ring-1 ring-primary text-foreground";
                      return (
                        <motion.button
                          key={r}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => handleRsvp(event.id, r)}
                          className={`flex-1 py-2.5 rounded-md text-xs font-medium flex items-center justify-center transition-all duration-150 ${
                            currentRsvp === r
                              ? activeClass
                              : "bg-secondary text-secondary-foreground hover:shadow-gloss-hover"
                          }`}
                        >
                          {labels[r]}
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {/* RSVP list */}
                <div className="space-y-1.5">
                  {rsvps.map((rsvp, j) => {
                    const status =
                      rsvpStates[event.id] && rsvp.user_id === user?.id
                        ? rsvpStates[event.id]
                        : (rsvp.response as "yes" | "no" | "maybe" | "pending");
                    return (
                      <motion.div
                        key={rsvp.user_id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...cyaTransition, delay: j * 0.05 }}
                        className="flex items-center justify-between py-1.5"
                      >
                        <span className="text-sm text-foreground">
                          {rsvp.users?.display_name ?? "Unknown"}
                        </span>
                        <span className="font-mono-data text-[11px]">
                          {status === "yes" ? (
                            <span className="text-primary">✓ YES</span>
                          ) : status === "no" ? (
                            <span className="text-destructive">✗ NO</span>
                          ) : status === "maybe" ? (
                            <span className="text-muted-foreground">😐 MAYBE</span>
                          ) : (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Clock size={10} /> PENDING
                            </span>
                          )}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.section>
          );
        })}

        {/* Group interests */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...cyaTransition, delay: 0.12 }}
          className="mb-6"
        >
          <h2 className="font-mono-data text-muted-foreground mb-2">Activities</h2>
          <p className="text-body text-xs mb-3">
            Select what your group enjoys. We'll suggest the best fit for your next window.
          </p>
          <GroupInterests groupId={group.id} interests={group.group_interests} />
        </motion.section>

        {/* Members */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono-data text-muted-foreground">Members</h2>
            {isCreator && (
              <span className="font-mono-data text-[10px] text-muted-foreground uppercase">
                Can invite
              </span>
            )}
          </div>
          <div className="space-y-2">
            {group.group_members.map((member, i) => {
              const synced = syncedUserIds.has(member.user_id);
              const isSelf = member.user_id === user?.id;
              return (
                <motion.div
                  key={member.user_id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...cyaTransition, delay: i * 0.05 }}
                  className="glass-surface rounded-md p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-secondary-foreground">
                      {(member.users?.display_name ?? "?")[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {member.users?.display_name ?? "Unknown"}
                      </p>
                      <p className="font-mono-data text-[10px] text-muted-foreground">
                        {member.role}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      {synced ? (
                        <span className="w-2 h-2 rounded-full bg-accent cyan-glow" />
                      ) : (
                        <AlertTriangle size={12} className="text-muted-foreground" />
                      )}
                      <span className="font-mono-data text-[10px] text-muted-foreground">
                        {synced ? "SYNCED" : "NO DATA"}
                      </span>
                    </div>

                    {/* Can-invite toggle: visible to creator, hidden for self */}
                    {isCreator && !isSelf && (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() =>
                          updateCanInvite.mutate({
                            memberId: member.id,
                            groupId: group.id,
                            canInvite: !member.can_invite,
                          })
                        }
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title={member.can_invite ? "Revoke invite permission" : "Allow to invite"}
                      >
                        {member.can_invite ? (
                          <ToggleRight size={20} className="text-primary" />
                        ) : (
                          <ToggleLeft size={20} />
                        )}
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
};

export default GroupPage;
