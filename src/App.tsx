import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GoogleCalendarProvider } from "./contexts/GoogleCalendarContext";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <GoogleCalendarProvider>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AuthPage />} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/group/:groupId" element={<GroupPage />} />
          <Route path="/group/new" element={<CreateGroupPage />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/availability" element={<AvailabilityPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <BottomNav />
      </BrowserRouter>
    </TooltipProvider>
    </GoogleCalendarProvider>
  </QueryClientProvider>
);

export default App;
