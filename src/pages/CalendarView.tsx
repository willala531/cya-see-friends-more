import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cyaTransition } from "@/lib/motion";
import { useEvents } from "@/hooks/useEvents";
import type { DbHangoutSuggestion } from "@/types/database";

const CalendarView = () => {
  const navigate = useNavigate();
  const { data: events = [], isLoading } = useEvents();

  const sortedEvents = [...events].sort((a, b) => {
    if (!a.start_time) return 1;
    if (!b.start_time) return -1;
    return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  });

  const groupedByDate: Record<string, DbHangoutSuggestion[]> = {};
  sortedEvents.forEach((event) => {
    if (!event.start_time) return;
    const dateKey = new Date(event.start_time).toLocaleDateString("en-US", {
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

      {isLoading && (
        <p className="font-mono-data text-muted-foreground text-[11px] py-4">LOADING…</p>
      )}

      {Object.entries(groupedByDate).map(([dateKey, dayEvents], groupIdx) => (
        <section key={dateKey} className="mb-6">
          <h2 className="font-mono-data text-muted-foreground mb-3">{dateKey}</h2>
          <div className="space-y-2">
            {dayEvents.map((event, i) => {
              const start = event.start_time ? new Date(event.start_time) : null;
              const end = event.end_time ? new Date(event.end_time) : null;
              const yesCount = event.rsvps?.filter((r) => r.response === "yes").length ?? 0;
              const total = event.rsvps?.length ?? 0;
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...cyaTransition, delay: groupIdx * 0.1 + i * 0.05 }}
                  onClick={() => navigate(`/group/${event.group_id}`)}
                  className={`glass-surface rounded-lg p-4 cursor-pointer hover:shadow-gloss-hover transition-shadow duration-150 ${
                    event.status === "confirmed"
                      ? "border-l-2 border-l-accent"
                      : "border-l-2 border-l-primary"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{event.suggested_activity}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{event.groups?.name}</p>
                    </div>
                    <div className="text-right">
                      {start && (
                        <p className="font-mono-data text-foreground">
                          {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                      )}
                      {end && (
                        <p className="font-mono-data text-muted-foreground text-[11px]">
                          – {end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`font-mono-data text-[10px] px-1.5 py-0.5 rounded-sm ${
                        event.status === "confirmed"
                          ? "bg-accent/10 text-accent"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {event.status.toUpperCase()}
                    </span>
                    <span className="font-mono-data text-[10px] text-muted-foreground">
                      {yesCount}/{total} YES
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      ))}

      {!isLoading && sortedEvents.length === 0 && (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">No events yet</p>
          <p className="font-mono-data text-muted-foreground text-[11px] mt-1">
            Create a group and propose an event
          </p>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
