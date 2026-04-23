import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X } from "lucide-react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { GoogleCalendarProvider } from "@/contexts/GoogleCalendarContext";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import GroupPage from "./pages/GroupPage";
import CreateGroupPage from "./pages/CreateGroupPage";
import CalendarView from "./pages/CalendarView";
import ProfilePage from "./pages/ProfilePage";
import AvailabilityPage from "./pages/AvailabilityPage";
import WelcomePage from "./pages/WelcomePage";
import NotificationsPage from "./pages/NotificationsPage";
import BottomNav from "./components/BottomNav";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-background" />;
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
                Get notified when your group plans a hangout 🔔
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

// ─── App ──────────────────────────────────────────────────────────────────────

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <GoogleCalendarProvider>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
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
