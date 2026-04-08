import { motion } from "framer-motion";
import { mockEvents } from "@/data/mockData";
import { useNavigate } from "react-router-dom";
import { cyaTransition } from "@/lib/motion";

const CalendarView = () => {
  const navigate = useNavigate();
  const sortedEvents = [...mockEvents].sort(
    (a, b) => new Date(a.proposedSlot.startTime).getTime() - new Date(b.proposedSlot.startTime).getTime()
  );

  const groupedByDate: Record<string, typeof mockEvents> = {};
  sortedEvents.forEach((event) => {
    const dateKey = new Date(event.proposedSlot.startTime).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(event);
  });

  return (
    <div className="pb-24 px-4 pt-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-xl text-heading">Calendar</h1>
        <p className="text-body text-xs mt-0.5">all upcoming events</p>
      </div>

      {Object.entries(groupedByDate).map(([dateKey, events], groupIdx) => (
        <section key={dateKey} className="mb-6">
          <h2 className="font-mono-data text-muted-foreground mb-3">{dateKey}</h2>
          <div className="space-y-2">
            {events.map((event, i) => {
              const start = new Date(event.proposedSlot.startTime);
              const end = new Date(event.proposedSlot.endTime);
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...cyaTransition, delay: groupIdx * 0.1 + i * 0.05 }}
                  onClick={() => navigate(`/group/${event.groupId}`)}
                  className={`glass-surface rounded-lg p-4 cursor-pointer hover:shadow-gloss-hover transition-shadow duration-150 ${
                    event.status === "confirmed" ? "border-l-2 border-l-accent" : "border-l-2 border-l-primary"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{event.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{event.groupName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono-data text-foreground">
                        {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </p>
                      <p className="font-mono-data text-muted-foreground text-[11px]">
                        – {end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`font-mono-data text-[10px] px-1.5 py-0.5 rounded-sm ${
                      event.status === "confirmed" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"
                    }`}>
                      {event.status.toUpperCase()}
                    </span>
                    <span className="font-mono-data text-[10px] text-muted-foreground">
                      {event.rsvps.filter((r) => r.status === "yes").length}/{event.rsvps.length} YES
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      ))}

      {sortedEvents.length === 0 && (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">No events yet</p>
          <p className="font-mono-data text-muted-foreground text-[11px] mt-1">Create a group and propose an event</p>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
