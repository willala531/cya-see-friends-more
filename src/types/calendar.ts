// A single busy time block (from Google Calendar or manually entered)
export interface BusyInterval {
  start: string; // ISO 8601
  end: string;   // ISO 8601
  source: "google" | "manual";
}

// A recurring weekly unavailable block (e.g. "every Tuesday 6–9pm")
export interface RecurringBlock {
  id: string;
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday (JS convention)
  startTime: string; // "HH:MM" 24-hour
  endTime: string;   // "HH:MM" 24-hour
  label?: string;
}

export interface CalendarState {
  connected: boolean;
  accessToken: string | null;
  tokenExpiry: number | null; // Unix ms timestamp
  googleBusyIntervals: BusyInterval[];
  manualBlocks: RecurringBlock[];
  lastSynced: string | null; // ISO string
}

// ─── Google Identity Services minimal types ────────────────────────────────

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

export interface GoogleTokenClient {
  requestAccessToken(config?: { prompt?: string }): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
            error_callback?: (error: { type: string; message?: string }) => void;
          }): GoogleTokenClient;
        };
      };
    };
  }
}
