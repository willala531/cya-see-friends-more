import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, RefreshCw, Calendar } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cyaTransition } from "@/lib/motion";
import { useGoogleCalendar } from "@/contexts/GoogleCalendarContext";
import { useAvailabilityBlocks, useUpsertWeekSchedule } from "@/hooks/useAvailability";
import { usePostHog } from "@posthog/react";

// ─── Existing weekly schedule types (unchanged) ───────────────────────────────

interface TimeBlock {
  id: string;
  start: string;
  end: string;
}

interface DaySchedule {
  enabled: boolean;
  blocks: TimeBlock[];
}

type WeekSchedule = Record<string, DaySchedule>;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHORT_DAYS: Record<string, string> = {
  Monday: "MON", Tuesday: "TUE", Wednesday: "WED", Thursday: "THU",
  Friday: "FRI", Saturday: "SAT", Sunday: "SUN",
};

const defaultSchedule: WeekSchedule = Object.fromEntries(
  DAYS.map((day) => [
    day,
    {
      enabled: !["Saturday", "Sunday"].includes(day),
      blocks: !["Saturday", "Sunday"].includes(day)
        ? [{ id: crypto.randomUUID(), start: "09:00", end: "17:00" }]
        : [],
    },
  ])
);

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

function formatTime(t: string) {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr} ${suffix}`;
}

// ─── Day-of-week helpers for recurring blocks ─────────────────────────────────

// Ordered Sun–Sat (matches JS Date.getDay())
const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Component ────────────────────────────────────────────────────────────────

const AvailabilityPage = () => {
  const navigate = useNavigate();
  const posthog = usePostHog();

  // Existing weekly schedule — loaded from Supabase on mount
  const [schedule, setSchedule] = useState<WeekSchedule>(defaultSchedule);
  const [saved, setSaved] = useState(false);
  const initializedRef = useRef(false);

  const { data: userBlocks = [], isLoading: blocksLoading } = useAvailabilityBlocks();
  const upsertWeekSchedule = useUpsertWeekSchedule();

  // Hydrate schedule from DB once blocks have loaded (first load only)
  useEffect(() => {
    if (blocksLoading || initializedRef.current) return;
    initializedRef.current = true;
    const scheduleBlock = userBlocks.find((b) => b.source === "schedule");
    if (scheduleBlock?.recurrence_rule) {
      setSchedule(scheduleBlock.recurrence_rule as unknown as WeekSchedule);
    }
  }, [blocksLoading, userBlocks]);

  // New recurring blocks (from Google Calendar context)
  const {
    connected,
    isTokenValid,
    isSyncing,
    googleBusyIntervals,
    manualBlocks,
    lastSynced,
    syncCalendar,
    addManualBlock,
    removeManualBlock,
  } = useGoogleCalendar();

  // Draft state for the "add recurring block" form
  const [draftDow, setDraftDow] = useState(2); // Tuesday default
  const [draftStart, setDraftStart] = useState("18:00");
  const [draftEnd, setDraftEnd] = useState("21:00");

  // ── Existing schedule handlers ──────────────────────────────────────────────

  const toggleDay = (day: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled,
        blocks:
          !prev[day].enabled && prev[day].blocks.length === 0
            ? [{ id: crypto.randomUUID(), start: "09:00", end: "17:00" }]
            : prev[day].blocks,
      },
    }));
  };

  const updateBlock = (day: string, blockId: string, field: "start" | "end", value: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        blocks: prev[day].blocks.map((b) =>
          b.id === blockId ? { ...b, [field]: value } : b
        ),
      },
    }));
  };

  const addBlock = (day: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        blocks: [
          ...prev[day].blocks,
          { id: crypto.randomUUID(), start: "12:00", end: "13:00" },
        ],
      },
    }));
  };

  const removeBlock = (day: string, blockId: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        blocks: prev[day].blocks.filter((b) => b.id !== blockId),
      },
    }));
  };

  const handleSave = () => {
    upsertWeekSchedule.mutate(schedule as unknown as Record<string, unknown>, {
      onSuccess: () => {
        posthog.capture("availability_saved");
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
      onError: () => toast.error("Failed to save availability"),
    });
  };

  // ── Recurring block handler ─────────────────────────────────────────────────

  const handleAddRecurring = () => {
    if (draftStart >= draftEnd) return; // basic guard
    addManualBlock({ dayOfWeek: draftDow, startTime: draftStart, endTime: draftEnd });
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="pb-24 px-4 pt-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center"
        >
          <ArrowLeft size={16} className="text-secondary-foreground" />
        </motion.button>
        <div>
          <h1 className="text-xl text-heading">Busy Times</h1>
          <p className="text-body text-xs mt-0.5">Block off times you're regularly unavailable</p>
        </div>
      </div>

      {/* ── Google Calendar status banner ──────────────────────────────────── */}
      {connected && isTokenValid && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={cyaTransition}
          className="glass-surface rounded-lg p-3 mb-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-accent" />
            <div>
              <p className="text-xs font-medium text-foreground">
                Google Calendar synced
              </p>
              <p className="font-mono-data text-[10px] text-muted-foreground uppercase">
                {googleBusyIntervals.length} busy block
                {googleBusyIntervals.length !== 1 ? "s" : ""}
                {lastSynced
                  ? ` · ${format(new Date(lastSynced), "MMM d, h:mm a")}`
                  : ""}
              </p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => { posthog.capture("calendar_synced"); syncCalendar(); }}
            disabled={isSyncing}
            className="flex items-center gap-1 text-primary text-[11px] font-mono-data disabled:opacity-50"
          >
            <RefreshCw size={11} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? "SYNCING" : "SYNC"}
          </motion.button>
        </motion.div>
      )}

      {/* ── Weekly schedule (existing) ─────────────────────────────────────── */}
      <p className="font-mono-data text-muted-foreground text-[11px] uppercase mb-2 px-0.5">
        Weekly schedule
      </p>
      <div className="space-y-2">
        {DAYS.map((day, i) => (
          <motion.div
            key={day}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...cyaTransition, delay: i * 0.03 }}
            className="glass-surface rounded-lg p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => toggleDay(day)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${
                    schedule[day].enabled ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <motion.div
                    animate={{ x: schedule[day].enabled ? 20 : 2 }}
                    transition={{ type: "tween", duration: 0.15 }}
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-primary-foreground shadow-sm"
                  />
                </motion.button>
                <span
                  className={`font-mono-data text-xs ${
                    schedule[day].enabled ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {SHORT_DAYS[day]}
                </span>
              </div>
              {schedule[day].enabled && (
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => addBlock(day)}
                  className="flex items-center gap-1 text-primary text-[11px] font-mono-data"
                >
                  <Plus size={12} /> ADD
                </motion.button>
              )}
            </div>

            {schedule[day].enabled && (
              <div className="space-y-2 ml-[52px]">
                {schedule[day].blocks.map((block) => (
                  <div key={block.id} className="flex items-center gap-2">
                    <select
                      value={block.start}
                      onChange={(e) => updateBlock(day, block.id, "start", e.target.value)}
                      className="bg-secondary text-foreground text-xs rounded-md px-2 py-1.5 border border-border font-mono-data appearance-none cursor-pointer"
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>{formatTime(t)}</option>
                      ))}
                    </select>
                    <span className="text-muted-foreground text-xs">—</span>
                    <select
                      value={block.end}
                      onChange={(e) => updateBlock(day, block.id, "end", e.target.value)}
                      className="bg-secondary text-foreground text-xs rounded-md px-2 py-1.5 border border-border font-mono-data appearance-none cursor-pointer"
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>{formatTime(t)}</option>
                      ))}
                    </select>
                    {schedule[day].blocks.length > 1 && (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => removeBlock(day, block.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={13} />
                      </motion.button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {schedule[day].enabled && schedule[day].blocks.length === 0 && (
              <p className="text-muted-foreground text-[11px] ml-[52px] font-mono-data">
                NO BUSY TIMES — FULLY AVAILABLE
              </p>
            )}
          </motion.div>
        ))}
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSave}
        disabled={upsertWeekSchedule.isPending}
        className="w-full mt-5 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-gloss disabled:opacity-60"
      >
        {saved ? "✓ saved" : upsertWeekSchedule.isPending ? "saving…" : "save availability"}
      </motion.button>

      {/* ── Recurring unavailable blocks ───────────────────────────────────── */}
      <div className="mt-8">
        <p className="font-mono-data text-muted-foreground text-[11px] uppercase mb-2 px-0.5">
          Recurring unavailable blocks
        </p>
        <p className="text-body text-xs mb-3">
          Add specific recurring commitments (e.g. every Tuesday 6–9pm for gym).
          These are stored alongside your Google Calendar busy times.
        </p>

        {/* Existing recurring blocks */}
        <div className="space-y-2 mb-3">
          {manualBlocks.length === 0 && (
            <p className="font-mono-data text-muted-foreground text-[11px] py-2">
              NO RECURRING BLOCKS ADDED YET
            </p>
          )}
          {manualBlocks.map((block) => (
            <motion.div
              key={block.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={cyaTransition}
              className="glass-surface rounded-lg p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono-data text-xs text-primary w-8">
                  {DOW_LABELS[block.dayOfWeek]}
                </span>
                <span className="text-sm text-foreground">
                  {formatTime(block.startTime)} — {formatTime(block.endTime)}
                </span>
                {block.label && (
                  <span className="text-xs text-muted-foreground">{block.label}</span>
                )}
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => removeManualBlock(block.id)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 size={13} />
              </motion.button>
            </motion.div>
          ))}
        </div>

        {/* Add new recurring block */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...cyaTransition, delay: 0.05 }}
          className="glass-surface rounded-lg p-3"
        >
          <p className="font-mono-data text-muted-foreground text-[10px] uppercase mb-2.5">
            Add block
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Day of week */}
            <select
              value={draftDow}
              onChange={(e) => setDraftDow(Number(e.target.value))}
              className="bg-secondary text-foreground text-xs rounded-md px-2 py-1.5 border border-border font-mono-data appearance-none cursor-pointer"
            >
              {DOW_LABELS.map((label, i) => (
                <option key={i} value={i}>{label}</option>
              ))}
            </select>

            {/* Start time */}
            <select
              value={draftStart}
              onChange={(e) => setDraftStart(e.target.value)}
              className="bg-secondary text-foreground text-xs rounded-md px-2 py-1.5 border border-border font-mono-data appearance-none cursor-pointer"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{formatTime(t)}</option>
              ))}
            </select>

            <span className="text-muted-foreground text-xs">—</span>

            {/* End time */}
            <select
              value={draftEnd}
              onChange={(e) => setDraftEnd(e.target.value)}
              className="bg-secondary text-foreground text-xs rounded-md px-2 py-1.5 border border-border font-mono-data appearance-none cursor-pointer"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{formatTime(t)}</option>
              ))}
            </select>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleAddRecurring}
              disabled={draftStart >= draftEnd}
              className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium shadow-gloss disabled:opacity-40"
            >
              <Plus size={12} /> Add
            </motion.button>
          </div>
          {draftStart >= draftEnd && (
            <p className="font-mono-data text-destructive text-[10px] mt-1.5 uppercase">
              End time must be after start time
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AvailabilityPage;
