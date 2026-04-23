import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, BellOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cyaTransition } from "@/lib/motion";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/useNotifications";
import type { DbNotification } from "@/types/database";

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { data: notifications = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleTap = (n: DbNotification) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.group_id) navigate(`/group/${n.group_id}`);
  };

  return (
    <div className="pb-24 px-4 pt-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center"
        >
          <ArrowLeft size={16} className="text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg text-heading">Notifications</h1>
          <p className="font-mono-data text-muted-foreground text-[11px]">
            {unreadCount > 0 ? `${unreadCount} UNREAD` : "ALL CAUGHT UP"}
          </p>
        </div>
        {unreadCount > 0 && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => markAllRead.mutate()}
            className="text-xs font-mono-data text-primary"
          >
            MARK ALL READ
          </motion.button>
        )}
      </div>

      {isLoading && (
        <p className="font-mono-data text-muted-foreground text-[11px] py-4">
          LOADING…
        </p>
      )}

      {!isLoading && notifications.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4">
            <BellOff size={20} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">
            No notifications yet
          </p>
          <p className="text-body text-xs">
            We'll let you know when your group plans a hangout.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {notifications.map((n, i) => (
          <motion.button
            key={n.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...cyaTransition, delay: i * 0.03 }}
            onClick={() => handleTap(n)}
            className={`w-full glass-surface rounded-lg p-3.5 text-left flex items-start gap-3 hover:shadow-gloss-hover transition-shadow duration-150 ${
              !n.read ? "ring-1 ring-primary/20" : ""
            }`}
          >
            {/* Unread dot */}
            <div className="mt-0.5 shrink-0">
              {n.read ? (
                <Bell size={15} className="text-muted-foreground" />
              ) : (
                <div className="relative">
                  <Bell size={15} className="text-primary" />
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p
                className={`text-sm leading-snug ${
                  n.read ? "text-muted-foreground" : "text-foreground font-medium"
                }`}
              >
                {n.message}
              </p>
              <p className="font-mono-data text-[10px] text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(n.created_at), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default NotificationsPage;
