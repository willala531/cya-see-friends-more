import { NavLink, useLocation } from "react-router-dom";
import { Users, Calendar, User, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { useUnreadCount } from "@/hooks/useNotifications";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { to: "/dashboard", icon: Users, label: "Groups" },
  { to: "/calendar", icon: Calendar, label: "Calendar" },
  { to: "/notifications", icon: Bell, label: "Alerts" },
  { to: "/profile", icon: User, label: "Profile" },
];

const BottomNav = () => {
  const location = useLocation();
  const { session } = useAuth();
  const unreadCount = useUnreadCount();

  // Don't show on auth page
  if (location.pathname === "/") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-surface border-t border-border">
      <div className="max-w-lg mx-auto flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          const isBell = item.to === "/notifications";
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex flex-col items-center gap-0.5 py-1 px-4 relative"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-0.5 w-6 h-0.5 rounded-full bg-primary"
                  transition={{ type: "tween", ease: [0.2, 0.0, 0, 1.0], duration: 0.3 }}
                />
              )}
              <div className="relative">
                <item.icon
                  size={20}
                  className={isActive ? "text-primary" : "text-muted-foreground"}
                />
                {/* Unread badge on bell */}
                {isBell && session && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-[3px]">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-mono-data ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {item.label.toUpperCase()}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
