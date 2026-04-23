import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const SW_PATH = "/sw.js";

/** Convert a base64url string to a Uint8Array (required by pushManager.subscribe). */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/** Current browser push permission state. */
export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export function usePushSubscription() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<PushPermission>(() => {
    if (typeof window === "undefined" || !("Notification" in window))
      return "unsupported";
    return Notification.permission as PushPermission;
  });
  const [isRegistering, setIsRegistering] = useState(false);

  // Keep permission state in sync if it changes outside our component
  useEffect(() => {
    if (!("Notification" in window)) return;
    setPermission(Notification.permission as PushPermission);
  }, []);

  /** Register SW, get push subscription, and store it in Supabase. */
  const requestAndSubscribe = useCallback(async () => {
    if (!user || !VAPID_PUBLIC_KEY) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    setIsRegistering(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);
      if (perm !== "granted") return;

      // Register (or retrieve existing) service worker
      const registration = await navigator.serviceWorker.register(SW_PATH, {
        scope: "/",
      });
      await navigator.serviceWorker.ready;

      // Get or create push subscription
      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      // Persist to Supabase (upsert on user_id so we replace stale subscriptions)
      const { error } = await supabase.from("push_subscriptions").upsert(
        { user_id: user.id, subscription: sub.toJSON() },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    } finally {
      setIsRegistering(false);
    }
  }, [user]);

  /** Unsubscribe and remove from Supabase. */
  const unsubscribe = useCallback(async () => {
    if (!user) return;
    const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe();
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id);
    setPermission("default");
  }, [user]);

  const isPushSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    !!VAPID_PUBLIC_KEY;

  return {
    permission,
    isPushSupported,
    isRegistering,
    requestAndSubscribe,
    unsubscribe,
  };
}
