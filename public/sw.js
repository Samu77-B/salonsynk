const CACHE_NAME = "salonsynk-v7";

function shouldCache(request, response) {
  if (!response || !response.ok || response.type !== "basic") return false;
  if (!request.url.startsWith(self.location.origin)) return false;
  const u = new URL(request.url);
  // Only cache non-Next static assets; skip documents, APIs, and build chunks.
  if (request.mode === "navigate" || request.destination === "document") return false;
  if (u.pathname.startsWith("/_next/") || u.pathname.startsWith("/api/")) return false;
  // Never cache brand logos/favicons — they change often and stale SW cache is confusing.
  if (
    u.pathname.startsWith("/imgs/") ||
    u.pathname.startsWith("/favicon") ||
    u.pathname.includes("logo") ||
    u.pathname.includes("icon")
  ) {
    return false;
  }
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
  if (u.pathname.startsWith("/imgs/")) return true;
  if (u.pathname.includes("logo") || u.pathname.includes("-icon")) return true;
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
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(["/offline.html"]).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Full navigations use network-first with an offline document fallback.
  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(event.request);
        } catch {
          try {
            const cache = await caches.open(CACHE_NAME);
            const offlineDoc = await cache.match("/offline.html");
            if (offlineDoc) return offlineDoc;
          } catch {
            // Fall through to minimal inline fallback.
          }
          return new Response(
            "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Offline</title></head><body style='font-family:system-ui,sans-serif;padding:24px;line-height:1.4'><h1>You're offline</h1><p>Please check your connection and try again.</p></body></html>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        }
      })()
    );
    return;
  }

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
        // Await so rejection is caught by outer try/catch and doesn't reject respondWith.
        return await fetch(event.request);
      } catch {
        try {
          return await fetch(event.request);
        } catch {
          return new Response("Offline", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      }
    })()
  );
});
