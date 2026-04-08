import { motion } from "framer-motion";
import { Calendar, CheckCircle2, RefreshCw, Unlink } from "lucide-react";
import { format } from "date-fns";
import { useGoogleCalendar } from "@/contexts/GoogleCalendarContext";
import { cyaTransition } from "@/lib/motion";

interface GoogleCalendarConnectProps {
  /** "card" renders a full-width card (WelcomePage style).
   *  "row" renders a compact inline row (ProfilePage style). */
  variant?: "card" | "row";
  /** Called after a successful connection (e.g. to navigate away). */
  onConnected?: () => void;
}

export default function GoogleCalendarConnect({
  variant = "row",
  onConnected,
}: GoogleCalendarConnectProps) {
  const { connected, isTokenValid, isSyncing, lastSynced, connect, disconnect, syncCalendar } =
    useGoogleCalendar();

  const handleConnect = () => {
    connect();
    onConnected?.();
  };

  // ── Card variant (WelcomePage) ────────────────────────────────────────────

  if (variant === "card") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...cyaTransition, delay: 0.1 }}
        className="glass-surface rounded-lg p-6 w-full"
      >
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
          {connected && isTokenValid ? (
            <CheckCircle2 size={24} className="text-accent" />
          ) : (
            <Calendar size={24} className="text-primary" />
          )}
        </div>

        {connected && isTokenValid ? (
          <>
            <h2 className="text-base font-medium text-foreground mb-1 text-center">
              Calendar connected
            </h2>
            <p className="text-body text-xs mb-5 text-center">
              cya is reading your busy times automatically.
              {lastSynced && (
                <span className="block mt-1 font-mono-data text-[10px] text-muted-foreground uppercase">
                  Last sync {format(new Date(lastSynced), "MMM d, h:mm a")}
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => syncCalendar()}
                disabled={isSyncing}
                className="flex-1 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                {isSyncing ? "Syncing…" : "Sync now"}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={disconnect}
                className="flex-1 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium flex items-center justify-center gap-2"
              >
                <Unlink size={14} /> Disconnect
              </motion.button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-base font-medium text-foreground mb-1 text-center">
              Link your calendar
            </h2>
            <p className="text-body text-xs mb-5 text-center">
              Connect Google Calendar so cya can automatically find times when
              your whole group is free.
            </p>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleConnect}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-gloss flex items-center justify-center gap-2"
            >
              <Calendar size={16} /> Connect Google Calendar
            </motion.button>
          </>
        )}
      </motion.div>
    );
  }

  // ── Row variant (ProfilePage) ─────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Calendar
            size={16}
            className={connected && isTokenValid ? "text-accent" : "text-muted-foreground"}
          />
          <div>
            <span className="text-sm text-foreground">Google Calendar</span>
            {connected && isTokenValid && (
              <span className="ml-2 font-mono-data text-[10px] text-accent uppercase">
                connected
              </span>
            )}
          </div>
        </div>

        {connected && isTokenValid ? (
          <div className="flex items-center gap-1.5">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => syncCalendar()}
              disabled={isSyncing}
              className="px-2.5 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw size={11} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Syncing" : "Sync"}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={disconnect}
              className="px-2.5 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium"
            >
              Disconnect
            </motion.button>
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleConnect}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium shadow-gloss"
          >
            Connect
          </motion.button>
        )}
      </div>

      {connected && isTokenValid && lastSynced && (
        <p className="font-mono-data text-[10px] text-muted-foreground mt-1.5 ml-[26px] uppercase">
          Last synced {format(new Date(lastSynced), "MMM d, h:mm a")}
        </p>
      )}

      {connected && !isTokenValid && (
        <p className="text-[11px] text-destructive mt-1.5 ml-[26px]">
          Session expired —{" "}
          <button onClick={connect} className="underline">
            reconnect
          </button>
        </p>
      )}
    </div>
  );
}
