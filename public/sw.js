self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "알다마", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "알다마";
  const options = {
    body: data.body || "",
    tag: data.tag,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    requireInteraction: true,
    data: { url: data.url || "/dashboard" },
  };

  // 앱이 닫혀 있어도 푸시가 올 때마다 아이콘 배지 숫자를 갱신
  const tasks = [self.registration.showNotification(title, options)];
  if (typeof data.badgeCount === "number" && "setAppBadge" in navigator) {
    tasks.push(
      data.badgeCount > 0
        ? navigator.setAppBadge(data.badgeCount).catch(() => {})
        : navigator.clearAppBadge().catch(() => {}),
    );
  }

  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
