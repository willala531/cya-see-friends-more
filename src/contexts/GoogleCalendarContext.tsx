import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { fetchFreeBusy } from "@/lib/googleCalendar";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAvailabilityBlocks,
  useUpsertGoogleBlocks,
  useAddManualBlock,
  useRemoveAvailabilityBlock,
} from "@/hooks/useAvailability";
import type { BusyInterval, RecurringBlock } from "@/types/calendar";

// ─── Context type ─────────────────────────────────────────────────────────────

interface CalendarContextValue {
  /** True when a Google provider token is present in the Supabase session. */
  connected: boolean;
  /** Alias for connected — token is managed by Supabase, always valid while session exists. */
  isTokenValid: boolean;
  /** True while a freebusy request is in-flight. */
  isSyncing: boolean;
  /** Concrete busy intervals imported from Google Calendar. */
  googleBusyIntervals: BusyInterval[];
  /** Manually added recurring busy blocks. */
  manualBlocks: RecurringBlock[];
  /** ISO timestamp of the last successful Google Calendar sync. */
  lastSynced: string | null;
  /** Sync if already connected, otherwise redirect to Google sign-in. */
  connect: () => void;
  /** Clear all synced Google Calendar blocks from Supabase. */
  disconnect: () => void;
  /** Re-fetch freebusy from Google Calendar and save to Supabase. */
  syncCalendar: () => Promise<void>;
  /** Add a recurring manual unavailable block. */
  addManualBlock: (block: Omit<RecurringBlock, "id">) => void;
  /** Remove a manual block by its DB row ID. */
  removeManualBlock: (id: string) => void;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function GoogleCalendarProvider({ children }: { children: ReactNode }) {
  const { session, signInWithGoogle } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // All blocks for the current user — drives both googleBusyIntervals and manualBlocks
  const { data: allBlocks = [] } = useAvailabilityBlocks();
  const upsertGoogleBlocks = useUpsertGoogleBlocks();
  const addManualBlockMutation = useAddManualBlock();
  const removeBlockMutation = useRemoveAvailabilityBlock();

  // Connected means Supabase gave us a Google provider_token in the session
  const connected = Boolean(session?.provider_token);
  const isTokenValid = connected;

  // Derive busy intervals from Supabase rows (source='google', non-recurring)
  const googleBusyIntervals = useMemo<BusyInterval[]>(
    () =>
      allBlocks
        .filter((b) => b.source === "google" && !b.is_recurring && b.start_time && b.end_time)
        .map((b) => ({ start: b.start_time!, end: b.end_time!, source: "google" as const })),
    [allBlocks],
  );

  // Derive manual recurring blocks from Supabase rows (source='manual')
  const manualBlocks = useMemo<RecurringBlock[]>(
    () =>
      allBlocks
        .filter((b) => b.source === "manual")
        .map((b) => ({
          id: b.id,
          ...(b.recurrence_rule as Omit<RecurringBlock, "id">),
        })),
    [allBlocks],
  );

  // ── syncCalendar ────────────────────────────────────────────────────────────

  const syncCalendar = useCallback(async () => {
    const token = session?.provider_token;
    if (!token) {
      toast.error("Connect Google Calendar first.");
      return;
    }
    setIsSyncing(true);
    try {
      const intervals: BusyInterval[] = await fetchFreeBusy(token);
      await upsertGoogleBlocks.mutateAsync(intervals);
      setLastSynced(new Date().toISOString());
      toast.success(
        `Synced ${intervals.length} busy block${intervals.length !== 1 ? "s" : ""} from Google Calendar`,
      );
    } catch {
      toast.error("Failed to sync calendar. Try reconnecting.");
    } finally {
      setIsSyncing(false);
    }
  }, [session?.provider_token, upsertGoogleBlocks]);

  // ── connect ──────────────────────────────────────────────────────────────────
  // If we already have a provider token, sync immediately.
  // Otherwise redirect to Google OAuth (which returns a session with provider_token).

  const connect = useCallback(() => {
    if (session?.provider_token) {
      syncCalendar();
    } else {
      signInWithGoogle();
    }
  }, [session?.provider_token, syncCalendar, signInWithGoogle]);

  // ── disconnect ───────────────────────────────────────────────────────────────

  const disconnect = useCallback(async () => {
    await upsertGoogleBlocks.mutateAsync([]);
    setLastSynced(null);
    toast.success("Google Calendar disconnected");
  }, [upsertGoogleBlocks]);

  // ── manual blocks ────────────────────────────────────────────────────────────

  const addManualBlock = useCallback(
    (block: Omit<RecurringBlock, "id">) => {
      addManualBlockMutation.mutate(block);
    },
    [addManualBlockMutation],
  );

  const removeManualBlock = useCallback(
    (id: string) => {
      removeBlockMutation.mutate(id);
    },
    [removeBlockMutation],
  );

  return (
    <CalendarContext.Provider
      value={{
        connected,
        isTokenValid,
        isSyncing,
        googleBusyIntervals,
        manualBlocks,
        lastSynced,
        connect,
        disconnect,
        syncCalendar,
        addManualBlock,
        removeManualBlock,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGoogleCalendar() {
  const ctx = useContext(CalendarContext);
  if (!ctx) {
    throw new Error("useGoogleCalendar must be used within <GoogleCalendarProvider>");
  }
  return ctx;
}
