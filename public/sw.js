// cya — Service Worker
// Handles push events and notification clicks.

self.addEventListener("push", (event) => {
  let data = { title: "cya", body: "You have a new notification.", groupId: null };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    // ignore malformed payload
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: data.groupId ? `group-${data.groupId}` : "cya-notification",
      data: { groupId: data.groupId },
      requireInteraction: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const groupId = event.notification.data?.groupId;
  const url = groupId ? `/group/${groupId}` : "/dashboard";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing tab if one is open
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      }),
  );
});
