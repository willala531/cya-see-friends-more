import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { DbNotification } from "@/types/database";

// ─── Read ─────────────────────────────────────────────────────────────────────
// Note: the Realtime subscription that invalidates this query lives in
// <NotificationsRealtime> (App.tsx) — a singleton component that ensures only
// ONE channel is ever open regardless of how many components call useNotifications
// simultaneously (e.g. BottomNav via useUnreadCount + NotificationsPage).

/** All notifications for the current user, newest first. */
export function useNotifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as DbNotification[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

/** Number of unread notifications for the current user. */
export function useUnreadCount() {
  const { data: notifications = [] } = useNotifications();
  return notifications.filter((n) => !n.read).length;
}

// ─── Write ────────────────────────────────────────────────────────────────────

/** Mark one notification as read. */
export function useMarkNotificationRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });
}

/** Mark all unread notifications as read for the current user. */
export function useMarkAllNotificationsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });
}
