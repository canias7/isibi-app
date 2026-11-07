// CODER'S NOTIFICATIONS (owner, 2026-11-07, item 8, like Claude Code's pushes): this service worker only
// shows what Coder's server sends (Web Push) and opens the chat when one is tapped. It caches nothing and
// handles no requests: the page always comes from the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: "Coder", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(String(d.title || "Coder").slice(0, 120), {
    body: String(d.body || "").slice(0, 300),
    tag: String(d.tag || "coder"),
    renotify: true,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: typeof d.url === "string" && d.url.startsWith("/") ? d.url : "/" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin !== self.location.origin) continue;
      await w.focus();
      if ("navigate" in w) await w.navigate(url).catch(() => {});
      return;
    }
    await self.clients.openWindow(url);
  })());
});
