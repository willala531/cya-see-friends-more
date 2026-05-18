import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Users, Plus, ChevronRight, Star } from "lucide-react";
import { cyaTransition } from "@/lib/motion";
import { useGroups } from "@/hooks/useGroups";
import { useEvents } from "@/hooks/useEvents";

// Logo-derived pastel palette for group card accents
const PALETTE = [
  "#ff9c9b", // coral pink
  "#f3b0ec", // pink/purple
  "#bfb4fd", // lavender
  "#69a0c3", // teal blue
  "#ffd89f", // peach orange
  "#e2cf76", // yellow green
];

/**
 * Derives a consistent palette color from a group ID string.
 * Same group always gets the same color regardless of list order.
 */
function groupColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [starredGroups, setStarredGroups] = useState<Set<string>>(
    () => new Set(JSON.parse(localStorage.getItem("cya-starred-groups") || "[]")),
  );

  const { data: groups = [], isLoading: groupsLoading } = useGroups();
  const { data: events = [] } = useEvents();

  const upcomingEvents = events.filter((e) => e.status === "pending");
  const confirmedEvents = events.filter((e) => e.status === "confirmed");

  const toggleStar = (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    setStarredGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      localStorage.setItem("cya-starred-groups", JSON.stringify([...next]));
      return next;
    });
  };

  const sortedGroups = [...groups].sort((a, b) => {
    const aStarred = starredGroups.has(a.id) ? 1 : 0;
    const bStarred = starredGroups.has(b.id) ? 1 : 0;
    return bStarred - aStarred;
  });

  return (
    <div className="pb-24 px-4 pt-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl text-heading">cya</h1>
          <p className="text-body text-xs mt-0.5">
            {groupsLoading
              ? "loading…"
              : `${groups.length} group${groups.length !== 1 ? "s" : ""} • ${events.length} upcoming`}
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate("/group/new")}
          className="w-9 h-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center shadow-gloss"
        >
          <Plus size={18} />
        </motion.button>
      </div>

      {upcomingEvents.length > 0 && (
        <section className="mb-6">
          <h2 className="font-mono-data text-muted-foreground mb-3">Active Proposals</h2>
          <div className="space-y-3">
            {upcomingEvents.map((event, i) => {
              const yesCount = event.rsvps?.filter((r) => r.response === "yes").length ?? 0;
              const total = event.rsvps?.length ?? 0;
              const date = event.start_time ? new Date(event.start_time) : null;
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...cyaTransition, delay: i * 0.05 }}
                  onClick={() => navigate(`/group/${event.group_id}`)}
                  className="glass-surface rounded-lg p-4 cursor-pointer hover:shadow-gloss-hover transition-shadow duration-150"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{event.suggested_activity}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{event.groups?.name}</p>
                    </div>
                    <div className="text-right">
                      {date && (
                        <p className="font-mono-data text-primary">
                          {date.toLocaleDateString("en-US", { weekday: "short" })}{" "}
                          {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                      )}
                      <p className="font-mono-data text-muted-foreground text-[11px] mt-0.5">
                        {yesCount}/{total} yes
                      </p>
                    </div>
                  </div>
                  {total > 0 && (
                    <div className="mt-3 h-1 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(yesCount / total) * 100}%` }}
                        transition={{ ...cyaTransition, delay: i * 0.05 + 0.2 }}
                      />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {confirmedEvents.length > 0 && (
        <section className="mb-6">
          <h2 className="font-mono-data text-muted-foreground mb-3">Confirmed</h2>
          <div className="space-y-3">
            {confirmedEvents.map((event) => {
              const date = event.start_time ? new Date(event.start_time) : null;
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass-surface rounded-lg p-4 cursor-pointer hover:shadow-gloss-hover transition-shadow duration-150 border-l-2 border-l-accent"
                  onClick={() => navigate(`/group/${event.group_id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{event.suggested_activity}</p>
                      <p className="text-xs text-muted-foreground">{event.groups?.name}</p>
                    </div>
                    {date && (
                      <p className="font-mono-data text-accent">
                        {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-mono-data text-muted-foreground mb-3">Your Groups</h2>
        {groupsLoading ? (
          <p className="font-mono-data text-muted-foreground text-[11px] py-4">LOADING…</p>
        ) : (
          <div className="space-y-2">
            {sortedGroups.map((group, i) => {
              const isStarred = starredGroups.has(group.id);
              return (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...cyaTransition, delay: i * 0.05 }}
                  onClick={() => navigate(`/group/${group.id}`)}
                  className="glass-surface rounded-lg p-3.5 flex items-center justify-between cursor-pointer hover:shadow-gloss-hover transition-shadow duration-150"
                  style={{ borderLeft: `4px solid ${groupColor(group.id)}` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center">
                      <Users size={14} className="text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{group.name}</p>
                      <p className="text-xs text-muted-foreground">{group.group_members.length} members</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={(e) => toggleStar(e, group.id)}
                      className="p-1"
                    >
                      <Star
                        size={16}
                        className={isStarred ? "text-primary fill-primary" : "text-muted-foreground"}
                      />
                    </motion.button>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </div>
                </motion.div>
              );
            })}
            {groups.length === 0 && (
              <p className="font-mono-data text-muted-foreground text-[11px] py-4">
                NO GROUPS YET — CREATE ONE TO GET STARTED
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
