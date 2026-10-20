// Only this public, self-contained fallback is stored. Never cache app documents,
// RSC payloads, API/auth/payment responses, uploads, or cross-origin requests.
const OFFLINE_CACHE = "models-suite-public-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(OFFLINE_CACHE);
    await cache.add(new Request(OFFLINE_URL, { cache: "reload", credentials: "omit" }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith("models-suite-public-offline-") && name !== OFFLINE_CACHE) {
        await caches.delete(name);
      }
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || request.mode !== "navigate" || url.origin !== self.location.origin) return;
  // Authentication callbacks, APIs and downloads must never become an HTML fallback.
  if (/^\/(?:api|auth|\.well-known|downloads)(?:\/|$)/.test(url.pathname)) return;
  event.respondWith((async () => {
    try {
      return await fetch(request);
    } catch {
      return await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE }) ||
        new Response("Models Suite needs an internet connection. Reconnect and reload.", {
          status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        });
    }
  })());
});
