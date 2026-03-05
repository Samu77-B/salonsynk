const CACHE_NAME = "salonsynk-v2";

function shouldCache(request, response) {
  if (!response || !response.ok || response.type !== "basic") return false;
  if (!request.url.startsWith(self.location.origin)) return false;
  const u = new URL(request.url);
  // Only cache static assets; skip documents, API, and Next.js data
  if (request.mode === "navigate" || request.destination === "document") return false;
  if (u.pathname.startsWith("/_next/data/") || u.pathname.startsWith("/api/")) return false;
  return true;
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.url.startsWith("chrome-extension")) return;

  const respond = () =>
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request)
          .then((res) => {
            if (shouldCache(event.request, res)) {
              cache.put(event.request, res.clone()).catch(() => {});
            }
            return res;
          })
          .catch(() => (cached !== undefined ? cached : fetch(event.request)));
        return cached ?? fetchPromise;
      })
    );

  event.respondWith(respond().catch(() => fetch(event.request)));
});
