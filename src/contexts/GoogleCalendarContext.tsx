import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { fetchFreeBusy } from "@/lib/googleCalendar";
import type {
  BusyInterval,
  CalendarState,
  GoogleTokenClient,
  GoogleTokenResponse,
  RecurringBlock,
} from "@/types/calendar";

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "cya-google-calendar";
const SCOPES =
  "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadState(): CalendarState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CalendarState;
  } catch {
    // ignore
  }
  return {
    connected: false,
    accessToken: null,
    tokenExpiry: null,
    googleBusyIntervals: [],
    manualBlocks: [],
    lastSynced: null,
  };
}

// ─── Context type ─────────────────────────────────────────────────────────────

interface CalendarContextValue extends CalendarState {
  /** True when there is a non-expired access token. */
  isTokenValid: boolean;
  /** True while a freebusy request is in-flight. */
  isSyncing: boolean;
  /** Start the Google OAuth popup. On success, syncs immediately. */
  connect: () => void;
  /** Remove the token and all synced data. */
  disconnect: () => void;
  /** Re-fetch freebusy from Google Calendar. */
  syncCalendar: () => Promise<void>;
  /** Add a recurring manual unavailable block. */
  addManualBlock: (block: Omit<RecurringBlock, "id">) => void;
  /** Remove a manual block by id. */
  removeManualBlock: (id: string) => void;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function GoogleCalendarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CalendarState>(loadState);
  const [isSyncing, setIsSyncing] = useState(false);
  const tokenClientRef = useRef<GoogleTokenClient | null>(null);

  // Persist to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const isTokenValid = Boolean(
    state.accessToken &&
      state.tokenExpiry &&
      Date.now() < state.tokenExpiry
  );

  // ── syncCalendar ────────────────────────────────────────────────────────────

  const syncCalendar = useCallback(
    async (tokenOverride?: string) => {
      const token = tokenOverride ?? state.accessToken;
      if (!token) {
        toast.error("Connect Google Calendar first.");
        return;
      }
      setIsSyncing(true);
      try {
        const intervals: BusyInterval[] = await fetchFreeBusy(token);
        setState((prev) => ({
          ...prev,
          googleBusyIntervals: intervals,
          lastSynced: new Date().toISOString(),
        }));
        toast.success(
          `Synced ${intervals.length} busy block${intervals.length !== 1 ? "s" : ""} from Google Calendar`
        );
      } catch {
        toast.error("Failed to sync calendar. Try reconnecting.");
      } finally {
        setIsSyncing(false);
      }
    },
    [state.accessToken]
  );

  // ── connect ──────────────────────────────────────────────────────────────────

  const connect = useCallback(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    if (!clientId) {
      toast.error("VITE_GOOGLE_CLIENT_ID is not set. See .env.example.");
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      toast.error(
        "Google Identity Services not loaded yet. Check your connection and refresh."
      );
      return;
    }

    // Re-use existing token client or create one
    if (!tokenClientRef.current) {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (response: GoogleTokenResponse) => {
          if (response.error) {
            toast.error("Google sign-in was cancelled or denied.");
            return;
          }
          const expiry = Date.now() + response.expires_in * 1_000;
          setState((prev) => ({
            ...prev,
            connected: true,
            accessToken: response.access_token,
            tokenExpiry: expiry,
          }));
          // Kick off a sync with the fresh token immediately
          syncCalendar(response.access_token);
        },
        error_callback: (err) => {
          if (err.type !== "popup_closed") {
            toast.error("Google sign-in failed. Please try again.");
          }
        },
      });
    }

    // Skip the consent screen on re-auth (token refresh), show it first time
    tokenClientRef.current.requestAccessToken({
      prompt: state.connected ? "" : "consent",
    });
  }, [state.connected, syncCalendar]);

  // ── disconnect ───────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    setState({
      connected: false,
      accessToken: null,
      tokenExpiry: null,
      googleBusyIntervals: [],
      manualBlocks: state.manualBlocks, // keep manual blocks
      lastSynced: null,
    });
    tokenClientRef.current = null;
    toast.success("Google Calendar disconnected");
  }, [state.manualBlocks]);

  // ── manual blocks ────────────────────────────────────────────────────────────

  const addManualBlock = useCallback((block: Omit<RecurringBlock, "id">) => {
    setState((prev) => ({
      ...prev,
      manualBlocks: [
        ...prev.manualBlocks,
        { ...block, id: crypto.randomUUID() },
      ],
    }));
  }, []);

  const removeManualBlock = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      manualBlocks: prev.manualBlocks.filter((b) => b.id !== id),
    }));
  }, []);

  return (
    <CalendarContext.Provider
      value={{
        ...state,
        isTokenValid,
        isSyncing,
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
    throw new Error(
      "useGoogleCalendar must be used within <GoogleCalendarProvider>"
    );
  }
  return ctx;
}
