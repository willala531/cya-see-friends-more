import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { DbUser } from "@/types/database";
import posthog from "posthog-js";

// ─── Context type ─────────────────────────────────────────────────────────────

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: DbUser | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchOrCreateProfile(
  userId: string,
  email: string,
  displayName: string,
): Promise<DbUser | null> {
  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (existing) return existing as DbUser;

  // New users start with has_completed_onboarding: false so they see the
  // phone-number onboarding screen after their first login.
  const { data: created } = await supabase
    .from("users")
    .insert({ id: userId, email, display_name: displayName, has_completed_onboarding: false })
    .select()
    .single();

  return created as DbUser | null;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<DbUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION immediately on mount in supabase-js v2,
    // which is the canonical way to hydrate auth state. We do NOT call getSession()
    // separately — doing both creates a race where getSession() can resolve with null
    // before the session is restored from storage, flipping isLoading to false with
    // session=null and causing ProtectedRoute to redirect authenticated users to "/".
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);

      if (session?.user) {
        try {
          const p = await fetchOrCreateProfile(
            session.user.id,
            session.user.email ?? "",
            session.user.user_metadata?.full_name ??
              session.user.email?.split("@")[0] ??
              "User",
          );
          setProfile(p);
          // Persist refresh token whenever we receive one
          if (session.provider_refresh_token) {
            await supabase
              .from("users")
              .update({ google_refresh_token: session.provider_refresh_token })
              .eq("id", session.user.id);
          }
          posthog.identify(session.user.id, {
            email: session.user.email,
            name: session.user.user_metadata?.full_name,
          });
          if (event === "SIGNED_IN") {
            posthog.capture("user_signed_in");
          }
        } finally {
          // Always clear loading — even if fetchOrCreateProfile throws,
          // so the UI never hangs indefinitely on a blank screen.
          setIsLoading(false);
        }
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Initiates Google OAuth with calendar scope.
  // Performs a full-page redirect; the session is restored on return via
  // onAuthStateChange above. redirectTo lands the user on /dashboard.
  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "https://www.googleapis.com/auth/calendar.readonly",
        queryParams: {
          access_type: "offline",  // request refresh token
          prompt: "consent",       // always show consent screen so we get refresh token
        },
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    posthog.reset();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        isLoading,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
