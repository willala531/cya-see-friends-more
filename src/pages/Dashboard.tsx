import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { mockGroups, mockEvents } from "@/data/mockData";
import { Users, Plus, ChevronRight, Star } from "lucide-react";
import { cyaTransition } from "@/lib/motion";

const Dashboard = () => {
  const navigate = useNavigate();
  const [starredGroups, setStarredGroups] = useState<Set<string>>(
    () => new Set(JSON.parse(localStorage.getItem("cya-starred-groups") || "[]"))
  );
  const upcomingEvents = mockEvents.filter((e) => e.status === "proposed");
  const confirmedEvents = mockEvents.filter((e) => e.status === "confirmed");

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

  const sortedGroups = [...mockGroups].sort((a, b) => {
    const aStarred = starredGroups.has(a.id) ? 1 : 0;
    const bStarred = starredGroups.has(b.id) ? 1 : 0;
    return bStarred - aStarred;
  });

  return (
    <div className="pb-24 px-4 pt-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl text-heading">cya</h1>
          <p className="text-body text-xs mt-0.5">3 groups • {mockEvents.length} events</p>
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
              const yesCount = event.rsvps.filter((r) => r.status === "yes").length;
              const total = event.rsvps.length;
              const date = new Date(event.proposedSlot.startTime);
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...cyaTransition, delay: i * 0.05 }}
                  onClick={() => navigate(`/group/${event.groupId}`)}
                  className="glass-surface rounded-lg p-4 cursor-pointer hover:shadow-gloss-hover transition-shadow duration-150"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{event.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{event.groupName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono-data text-primary">
                        {date.toLocaleDateString("en-US", { weekday: "short" })}{" "}
                        {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </p>
                      <p className="font-mono-data text-muted-foreground text-[11px] mt-0.5">
                        {yesCount}/{total} yes
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 h-1 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(yesCount / total) * 100}%` }}
                      transition={{ ...cyaTransition, delay: i * 0.05 + 0.2 }}
                    />
                  </div>
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
              const date = new Date(event.proposedSlot.startTime);
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass-surface rounded-lg p-4 cursor-pointer hover:shadow-gloss-hover transition-shadow duration-150 border-l-2 border-l-accent"
                  onClick={() => navigate(`/group/${event.groupId}`)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{event.title}</p>
                      <p className="text-xs text-muted-foreground">{event.groupName}</p>
                    </div>
                    <p className="font-mono-data text-accent">
                      {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-mono-data text-muted-foreground mb-3">Your Groups</h2>
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
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center">
                    <Users size={14} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{group.name}</p>
                    <p className="text-xs text-muted-foreground">{group.members.length} members</p>
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
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
