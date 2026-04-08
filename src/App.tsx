import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { GoogleCalendarProvider } from "@/contexts/GoogleCalendarContext";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import GroupPage from "./pages/GroupPage";
import CreateGroupPage from "./pages/CreateGroupPage";
import CalendarView from "./pages/CalendarView";
import ProfilePage from "./pages/ProfilePage";
import AvailabilityPage from "./pages/AvailabilityPage";
import WelcomePage from "./pages/WelcomePage";
import BottomNav from "./components/BottomNav";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Redirects unauthenticated users to the sign-in page.
// Renders a blank screen while the session is being hydrated to avoid flicker.
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-background" />;
  if (!session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <GoogleCalendarProvider>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<AuthPage />} />
              <Route path="/welcome" element={<ProtectedRoute><WelcomePage /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/group/new" element={<ProtectedRoute><CreateGroupPage /></ProtectedRoute>} />
              <Route path="/group/:groupId" element={<ProtectedRoute><GroupPage /></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><CalendarView /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/availability" element={<ProtectedRoute><AvailabilityPage /></ProtectedRoute>} />
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
