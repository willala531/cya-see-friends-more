import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { mockGroups, mockEvents, MOCK_MEMBER_BUSY_PATTERNS } from "@/data/mockData";
import { ArrowLeft, Link2, Check, X, Clock, AlertTriangle, CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { cyaTransition } from "@/lib/motion";
import { useGoogleCalendar } from "@/contexts/GoogleCalendarContext";
import { expandRecurringBlocks } from "@/lib/googleCalendar";
import {
  mergeAllUserBusy,
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
  const group = mockGroups.find((g) => g.id === groupId);
  const events = mockEvents.filter((e) => e.groupId === groupId);
  const [rsvpStates, setRsvpStates] = useState<Record<string, "yes" | "no" | "pending">>({});
  const [activities, setActivities] = useState<string[]>(
    () => JSON.parse(localStorage.getItem(`cya-activities-${groupId}`) || "[]")
  );

  const { googleBusyIntervals, manualBlocks } = useGoogleCalendar();

  const nearestSlot = useMemo(() => {
    if (!group) return null;

    const weekSchedule = (() => {
      try {
        const raw = localStorage.getItem("cya-availability");
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();

    const currentUserBusy = mergeAllUserBusy(
      googleBusyIntervals,
      manualBlocks,
      weekSchedule,
    );

    const membersBusy = group.members
      .filter((m) => m.synced)
      .map((m) => ({
        name: m.name,
        busyIntervals:
          m.userId === "u1"
            ? currentUserBusy
            : expandRecurringBlocks(MOCK_MEMBER_BUSY_PATTERNS[m.userId] ?? []),
      }));

    return getNearestSlot(membersBusy, DEFAULT_HANGOUT_DURATION);
  }, [group, googleBusyIntervals, manualBlocks]);

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Group not found</p>
      </div>
    );
  }

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(`https://cya.app/join/${group.inviteCode}`);
    toast.success("Invite link copied!");
  };

  const handleRsvp = (eventId: string, status: "yes" | "no") => {
    setRsvpStates((prev) => ({ ...prev, [eventId]: status }));
    toast.success(status === "yes" ? "You're in!" : "Maybe next time");
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
          <p className="font-mono-data text-muted-foreground text-[11px]">{group.members.length} members</p>
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
              {group.members.filter((m) => m.synced).length}/{group.members.length} members synced ·{" "}
              {DEFAULT_HANGOUT_DURATION / 60}h window
            </p>
          </div>
        </div>
      </motion.section>

      {events.map((event, i) => {
        const date = new Date(event.proposedSlot.startTime);
        const endDate = new Date(event.proposedSlot.endTime);
        const yesCount = event.rsvps.filter((r) => r.status === "yes").length;
        const currentRsvp = rsvpStates[event.id] || event.rsvps.find((r) => r.userId === "u1")?.status || "pending";

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
            <div className={`glass-surface rounded-lg p-5 ${event.status === "confirmed" ? "border-l-2 border-l-accent" : ""}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-base font-medium text-foreground">{event.title}</p>
                  <p className="text-body text-xs mt-0.5">{event.description}</p>
                </div>
                {event.status === "confirmed" && (
                  <span className="font-mono-data text-[10px] text-accent px-2 py-0.5 rounded-sm bg-accent/10">confirmed</span>
                )}
              </div>

              <div className="bg-secondary/50 rounded-md p-3 mb-4">
                <p className="font-mono-data text-foreground text-sm">
                  Best Fit: {date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                </p>
                <p className="font-mono-data text-primary mt-1">
                  {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} –{" "}
                  {endDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </p>
                <p className="font-mono-data text-muted-foreground text-[11px] mt-1">
                  {event.proposedSlot.score}/{event.rsvps.length} members free.{" "}
                  {yesCount >= Math.ceil(event.rsvps.length / 2) ? "Majority reached." : `Need ${Math.ceil(event.rsvps.length / 2) - yesCount} more.`}
                </p>
              </div>

              {event.status === "proposed" && (
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
                {event.rsvps.map((rsvp, j) => {
                  const status = rsvpStates[event.id] && rsvp.userId === "u1" ? rsvpStates[event.id] : rsvp.status;
                  return (
                    <motion.div
                      key={rsvp.userId}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ ...cyaTransition, delay: j * 0.05 }}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span className="text-sm text-foreground">{rsvp.userName}</span>
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

      <section>
        <h2 className="font-mono-data text-muted-foreground mb-3">Members</h2>
        <div className="space-y-2">
          {group.members.map((member, i) => (
            <motion.div
              key={member.userId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...cyaTransition, delay: i * 0.05 }}
              className="glass-surface rounded-md p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-secondary-foreground">
                  {member.name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{member.name}</p>
                  <p className="font-mono-data text-[10px] text-muted-foreground">{member.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {member.synced ? (
                  <span className="w-2 h-2 rounded-full bg-accent cyan-glow" />
                ) : (
                  <AlertTriangle size={12} className="text-muted-foreground" />
                )}
                <span className="font-mono-data text-[10px] text-muted-foreground">
                  {member.synced ? "SYNCED" : "NO DATA"}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default GroupPage;
