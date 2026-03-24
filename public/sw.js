const CACHE_NAME = "salonsynk-v4";

function shouldCache(request, response) {
  if (!response || !response.ok || response.type !== "basic") return false;
  if (!request.url.startsWith(self.location.origin)) return false;
  const u = new URL(request.url);
  // Only cache non-Next static assets; skip documents, APIs, and build chunks.
  if (request.mode === "navigate" || request.destination === "document") return false;
  if (u.pathname.startsWith("/_next/") || u.pathname.startsWith("/api/")) return false;
  if (!["style", "image", "font"].includes(request.destination)) return false;
  return true;
}

/** Do not intercept — let the browser handle these (Next.js App Router + server actions). */
function shouldBypassServiceWorker(request) {
  if (request.method !== "GET") return true;
  if (request.url.startsWith("chrome-extension")) return true;
  const u = new URL(request.url);
  // Full navigations must not go through cache-first logic (RSC/streaming breaks; avoids rejected respondWith).
  if (request.mode === "navigate" || request.destination === "document") return true;
  // Never intercept Next.js internals/chunks to avoid stale deploy asset mismatches.
  if (u.pathname.startsWith("/_next/")) return true;
  if (u.pathname.startsWith("/favicon")) return true;
  const h = request.headers;
  // Next.js RSC / router refresh / prefetch (GET to same URL as the page)
  if (h.get("RSC") === "1") return true;
  if (h.get("Next-Router-Prefetch") === "1") return true;
  if (h.get("Next-Router-State-Tree")) return true;
  const accept = h.get("Accept") || "";
  if (accept.includes("text/x-component")) return true;
  if (accept.includes("application/rsc")) return true;
  return false;
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
  if (shouldBypassServiceWorker(event.request)) return;

  event.respondWith(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        const network = fetch(event.request)
          .then((res) => {
            if (shouldCache(event.request, res)) {
              cache.put(event.request, res.clone()).catch(() => {});
            }
            return res;
          })
          .catch(() => null);

        if (cached) {
          try {
            const res = await network;
            if (res) return res;
          } catch {
            /* use cache below */
          }
          return cached;
        }

        const res = await network;
        if (res) return res;
        return fetch(event.request);
      } catch {
        try {
          return await fetch(event.request);
        } catch {
          return Response.error();
        }
      }
    })()
  );
});
