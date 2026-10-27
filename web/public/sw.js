// MyFlix service worker: shows notifications and opens the right page when one is tapped.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const base = self.registration.scope.replace(/\/$/, "");
  const link = (e.notification.data && e.notification.data.link) || "/browse";
  e.waitUntil(self.clients.openWindow(base + link));
});
self.addEventListener("push", (e) => {
  const d = e.data ? e.data.json() : { title: "MyFlix", body: "Something new is waiting for you." };
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body, data: { link: d.link } }));
});
