import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X } from "lucide-react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { GoogleCalendarProvider } from "@/contexts/GoogleCalendarContext";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { usePostHog } from "@posthog/react";
import { supabase } from "@/lib/supabase";
import { INVITE_TOKEN_KEY } from "@/pages/InvitePage";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import GroupPage from "./pages/GroupPage";
import CreateGroupPage from "./pages/CreateGroupPage";
import CalendarView from "./pages/CalendarView";
import ProfilePage from "./pages/ProfilePage";
import AvailabilityPage from "./pages/AvailabilityPage";
import WelcomePage from "./pages/WelcomePage";
import NotificationsPage from "./pages/NotificationsPage";
import InvitePage from "./pages/InvitePage";
import OnboardingPage from "./pages/OnboardingPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import BottomNav from "./components/BottomNav";
import NotFound from "./pages/NotFound";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Query client ─────────────────────────────────────────────────────────────
// staleTime: 60 s means data fetched by one component is reused by every other
// component that mounts within 60 s — eliminates the 5-6x duplicate requests
// seen when BottomNav, Dashboard, and GoogleCalendarProvider all mount at once.
// Realtime subscriptions call invalidateQueries to force fresh fetches when data
// actually changes, so live-update behaviour is fully preserved.

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,   // 60 seconds
      retry: 1,
    },
  },
});

// ─── App-shell skeleton ───────────────────────────────────────────────────────
// Shown while the Supabase session is being restored from storage on first load
// (direct URL visit or page refresh). Mirrors the dashboard layout so there is
// no visible layout shift once content loads.

function AppShellSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-24 px-4 pt-6 max-w-lg mx-auto">
      {/* Page header */}
      <Skeleton className="h-6 w-24 mb-6 rounded-md" />
      {/* Group cards */}
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-24 w-full mb-3 rounded-lg" />
      ))}
      {/* Secondary row */}
      <Skeleton className="h-14 w-full mb-3 rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  if (isLoading) return <AppShellSkeleton />;
  if (!session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// ─── Push permission banner ───────────────────────────────────────────────────
// Shown once per app session on authenticated pages when permission is 'default'.

const PUSH_DISMISSED_KEY = "cya-push-dismissed-at";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function PushPermissionBanner() {
  const { session } = useAuth();
  const location = useLocation();
  const { permission, isPushSupported, isRegistering, requestAndSubscribe } =
    usePushSubscription();
  const [visible, setVisible] = useState(false);
  const posthog = usePostHog();

  useEffect(() => {
    if (!session || !isPushSupported || permission !== "default") return;
    if (location.pathname === "/") return; // hide on auth page

    const dismissedAt = localStorage.getItem(PUSH_DISMISSED_KEY);
    if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_COOLDOWN_MS)
      return;

    const t = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(t);
  }, [session, isPushSupported, permission, location.pathname]);

  const handleAllow = async () => {
    posthog.capture("push_notifications_allowed");
    setVisible(false);
    await requestAndSubscribe();
  };

  const handleDismiss = () => {
    localStorage.setItem(PUSH_DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "tween", ease: [0.2, 0, 0, 1], duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-50 max-w-lg mx-auto px-4 pt-3"
        >
          <div className="glass-surface rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Bell size={15} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground leading-snug">
                Get notified when your group plans a hangout
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleAllow}
                disabled={isRegistering}
                className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-60"
              >
                {isRegistering ? "…" : "Allow"}
              </motion.button>
              <button
                onClick={handleDismiss}
                className="w-6 h-6 flex items-center justify-center rounded-md bg-secondary"
              >
                <X size={12} className="text-muted-foreground" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Post-auth handler ────────────────────────────────────────────────────────
// Runs once after every login. Priority order:
//   1. If sessionStorage holds an invite token (stored by InvitePage before OAuth),
//      call process-invite to complete the join and navigate to the group.
//   2. If the user hasn't completed onboarding, redirect to /onboarding.
//   3. Otherwise do nothing — normal routing takes over.

function PostAuthHandler() {
  const { user, profile, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const processedRef = useRef(false);

  useEffect(() => {
    // Wait until auth is fully resolved and profile is loaded
    if (isLoading || !user || !profile || processedRef.current) return;
    processedRef.current = true;

    const token = sessionStorage.getItem(INVITE_TOKEN_KEY);
    if (token) {
      // Complete the cross-OAuth invite join
      const groupName = sessionStorage.getItem("cya-invite-group-name") ?? "";
      sessionStorage.removeItem(INVITE_TOKEN_KEY);
      sessionStorage.removeItem("cya-invite-group-name");

      supabase.functions
        .invoke("process-invite", { body: { token, userId: user.id, type: "accept" } })
        .then(({ data }) => {
          if (data?.ok && data?.groupId) {
            navigate(
              `/group/${data.groupId}?welcome=${encodeURIComponent(data.groupName ?? groupName)}`,
              { replace: true },
            );
          } else {
            // Token invalid/expired — go to dashboard
            navigate("/dashboard", { replace: true });
          }
        })
        .catch(() => navigate("/dashboard", { replace: true }));
      return;
    }

    // Send new users to phone-number onboarding (only on the dashboard landing page)
    if (!profile.has_completed_onboarding && location.pathname === "/dashboard") {
      navigate("/onboarding", { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user?.id, profile?.has_completed_onboarding]);

  return null;
}

// ─── Notifications Realtime singleton ────────────────────────────────────────
// ONE channel per user, mounted here at the root so it's never duplicated even
// when both BottomNav (via useUnreadCount) and NotificationsPage are mounted.

function NotificationsRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-rt-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  return null;
}

// ─── App ──────────────────────────────────────────────────────────────────────

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <GoogleCalendarProvider>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <PostAuthHandler />
            <NotificationsRealtime />
            <PushPermissionBanner />
            <Routes>
              <Route path="/" element={<AuthPage />} />
              <Route
                path="/welcome"
                element={
                  <ProtectedRoute>
                    <WelcomePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/group/new"
                element={
                  <ProtectedRoute>
                    <CreateGroupPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/group/:groupId"
                element={
                  <ProtectedRoute>
                    <GroupPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendar"
                element={
                  <ProtectedRoute>
                    <CalendarView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/availability"
                element={
                  <ProtectedRoute>
                    <AvailabilityPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <NotificationsPage />
                  </ProtectedRoute>
                }
              />
              {/* Public routes — accessible without authentication */}
              <Route path="/invite/:token" element={<InvitePage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />

              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <OnboardingPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <BottomNav />
          </BrowserRouter>
        </TooltipProvider>
      </GoogleCalendarProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
