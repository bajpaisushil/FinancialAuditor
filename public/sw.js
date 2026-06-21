/* AuditKosh service worker — offline support (the "works with Wi-Fi off" promise).
 *
 * Lives in public/ on purpose: Vercel's Next.js builder only serves files that
 * are part of the build output (public/ assets + _next chunks). A service
 * worker generated *after* `next build` into out/ is NOT in Next's route
 * manifest, so Vercel answers /sw.js with its 404 handler. Shipping it from
 * public/ makes it a first-class asset that is always served at /sw.js.
 *
 * Strategy: runtime cache-first. We can't precache a manifest of hashed chunk
 * names from a static file, so instead we cache every same-origin GET as it is
 * fetched. The app warms the lazy PDF engine + worker on load (see
 * ServiceWorker.tsx) so those are cached while online and available offline.
 */
const CACHE = "auditkosh-runtime-v1";
const SHELL = ["/", "/index.html"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      // Best-effort, per-asset: a single failed/redirected request must not
      // abort the whole precache (cache.addAll is atomic and would).
      Promise.allSettled(SHELL.map((u) => c.add(new Request(u, { cache: "reload" }))))
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never touch cross-origin requests — let them hit the network on their own.
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    // ignoreSearch so hosts that append ?dpl=… (Vercel) still hit the cached asset.
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          req.mode === "navigate"
            ? caches.match("/index.html", { ignoreSearch: true }).then((r) => r || caches.match("/"))
            : Response.error()
        );
    })
  );
});
