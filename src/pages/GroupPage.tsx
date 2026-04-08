import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Link2, Check, X, Clock, AlertTriangle, CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { cyaTransition } from "@/lib/motion";
import { useAuth } from "@/contexts/AuthContext";
import { useGroup } from "@/hooks/useGroups";
import { useGroupEvents, useUpdateRsvp } from "@/hooks/useEvents";
import { useGroupAvailabilityBlocks } from "@/hooks/useAvailability";
import {
  blocksToUserBusy,
  getNearestSlot,
  formatNearestSlot,
  DEFAULT_HANGOUT_DURATION,
} from "@/lib/groupAvailability";

const ACTIVITY_OPTIONS = [
  "Dinner", "Drinks", "Hiking", "Board Games", "Movies",
  "Coffee", "Sports", "Concerts", "Road Trips", "Cooking",
  "Karaoke", "Beach", "Brunch", "Gym", "Study",
];

const GroupPage = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: group, isLoading: groupLoading } = useGroup(groupId);
  const { data: events = [] } = useGroupEvents(groupId);
  const { data: allBlocks = [] } = useGroupAvailabilityBlocks(groupId);
  const updateRsvp = useUpdateRsvp();

  // Optimistic RSVP state for instant UI feedback before the mutation settles
  const [rsvpStates, setRsvpStates] = useState<Record<string, "yes" | "no" | "pending">>({});
  const [activities, setActivities] = useState<string[]>(
    () => JSON.parse(localStorage.getItem(`cya-activities-${groupId}`) || "[]"),
  );

  // Members who have at least one availability block are considered "synced"
  const syncedUserIds = useMemo(
    () => new Set(allBlocks.map((b) => b.user_id)),
    [allBlocks],
  );

  // Compute nearest shared window entirely from Supabase availability data
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

  if (groupLoading || !group) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{groupLoading ? "Loading…" : "Group not found"}</p>
      </div>
    );
  }

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(`https://cya.app/join/${group.invite_code}`);
    toast.success("Invite link copied!");
  };

  const handleRsvp = (hangoutId: string, response: "yes" | "no") => {
    setRsvpStates((prev) => ({ ...prev, [hangoutId]: response }));
    updateRsvp.mutate(
      { hangoutId, response },
      {
        onSuccess: () => toast.success(response === "yes" ? "You're in!" : "Maybe next time"),
        onError: () => {
          // Roll back optimistic update on failure
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

  const toggleActivity = (activity: string) => {
    setActivities((prev) => {
      const next = prev.includes(activity)
        ? prev.filter((a) => a !== activity)
        : [...prev, activity];
      localStorage.setItem(`cya-activities-${groupId}`, JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="pb-24 px-4 pt-6 max-w-lg mx-auto">
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
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleCopyInvite}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-xs font-medium text-secondary-foreground hover:shadow-gloss-hover transition-shadow"
        >
          <Link2 size={12} />
          invite
        </motion.button>
      </div>

      {/* Activities */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={cyaTransition}
        className="mb-6"
      >
        <h2 className="font-mono-data text-muted-foreground mb-2">Activities</h2>
        <div className="flex flex-wrap gap-2">
          {ACTIVITY_OPTIONS.map((activity) => {
            const active = activities.includes(activity);
            return (
              <motion.button
                key={activity}
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleActivity(activity)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                  active
                    ? "bg-primary text-primary-foreground shadow-gloss"
                    : "bg-secondary text-secondary-foreground hover:shadow-gloss-hover"
                }`}
              >
                {active && <Check size={10} className="inline mr-1" />}
                {activity}
              </motion.button>
            );
          })}
        </div>
      </motion.section>

      {/* Next shared window */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...cyaTransition, delay: 0.08 }}
        className="mb-6"
      >
        <h2 className="font-mono-data text-muted-foreground mb-2">Next window</h2>
        <div className="glass-surface rounded-lg p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <CalendarCheck size={15} className="text-primary" />
          </div>
          <div>
            <p className="text-sm text-foreground leading-snug">
              {formatNearestSlot(nearestSlot)}
            </p>
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
        const yesCount = event.rsvps?.filter((r) => r.response === "yes").length ?? 0;
        const totalRsvps = event.rsvps?.length ?? 0;
        const currentRsvp =
          rsvpStates[event.id] ??
          (event.rsvps?.find((r) => r.user_id === user?.id)?.response as
            | "yes"
            | "no"
            | "pending"
            | undefined) ??
          "pending";

        return (
          <motion.section
            key={event.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...cyaTransition, delay: i * 0.08 }}
            className="mb-6"
          >
            <h2 className="font-mono-data text-muted-foreground mb-3">
              {event.status === "confirmed" ? "Upcoming" : "Proposal"}
            </h2>
            <div
              className={`glass-surface rounded-lg p-5 ${
                event.status === "confirmed" ? "border-l-2 border-l-accent" : ""
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-base font-medium text-foreground">{event.suggested_activity}</p>
                </div>
                {event.status === "confirmed" && (
                  <span className="font-mono-data text-[10px] text-accent px-2 py-0.5 rounded-sm bg-accent/10">
                    confirmed
                  </span>
                )}
              </div>

              {date && (
                <div className="bg-secondary/50 rounded-md p-3 mb-4">
                  <p className="font-mono-data text-foreground text-sm">
                    Best Fit:{" "}
                    {date.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <p className="font-mono-data text-primary mt-1">
                    {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    {endDate && (
                      <>
                        {" "}–{" "}
                        {endDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </>
                    )}
                  </p>
                  <p className="font-mono-data text-muted-foreground text-[11px] mt-1">
                    {yesCount}/{totalRsvps} members free.{" "}
                    {yesCount >= Math.ceil(totalRsvps / 2)
                      ? "Majority reached."
                      : `Need ${Math.ceil(totalRsvps / 2) - yesCount} more.`}
                  </p>
                </div>
              )}

              {event.status === "pending" && (
                <div className="flex gap-2 mb-4">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleRsvp(event.id, "yes")}
                    className={`flex-1 py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-1.5 transition-all duration-150 ${
                      currentRsvp === "yes"
                        ? "bg-primary text-primary-foreground shadow-gloss"
                        : "bg-secondary text-secondary-foreground hover:shadow-gloss-hover"
                    }`}
                  >
                    <Check size={14} /> yes
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleRsvp(event.id, "no")}
                    className={`flex-1 py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-1.5 transition-all duration-150 ${
                      currentRsvp === "no"
                        ? "bg-destructive text-destructive-foreground shadow-gloss"
                        : "bg-secondary text-secondary-foreground hover:shadow-gloss-hover"
                    }`}
                  >
                    <X size={14} /> no
                  </motion.button>
                </div>
              )}

              <div className="space-y-1.5">
                {event.rsvps?.map((rsvp, j) => {
                  const status =
                    rsvpStates[event.id] && rsvp.user_id === user?.id
                      ? rsvpStates[event.id]
                      : (rsvp.response as "yes" | "no" | "pending");
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

      {/* Members */}
      <section>
        <h2 className="font-mono-data text-muted-foreground mb-3">Members</h2>
        <div className="space-y-2">
          {group.group_members.map((member, i) => {
            const synced = syncedUserIds.has(member.user_id);
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
                    <p className="font-mono-data text-[10px] text-muted-foreground">{member.role}</p>
                  </div>
                </div>
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
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default GroupPage;
