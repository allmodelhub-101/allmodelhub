self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
// Intentionally no API/auth caching. The service worker is a safe PWA shell hook.
self.addEventListener("fetch", () => {});
