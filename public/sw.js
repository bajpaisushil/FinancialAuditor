/* AuditKosh service worker — offline support (the "works with Wi-Fi off" promise).
 *
 * Lives in public/ on purpose: Vercel's Next.js builder only serves files that
 * are part of the build output (public/ assets + _next chunks). A worker
 * generated *after* `next build` is not in Next's route manifest, so /sw.js
 * 404s. Shipping it from public/ makes it a first-class asset served at /sw.js.
 *
 * Caching strategy:
 *  - Navigations (HTML): network-first, fall back to cache offline. This is what
 *    lets new deploys actually reach returning users — a cache-first HTML would
 *    pin everyone to the first version they ever loaded.
 *  - Hashed static assets (/_next/static/) and the pinned PDF worker: cache-first.
 *    Their URLs are content-hashed/version-pinned, so the cached copy is always
 *    correct and we avoid re-downloading (the worker is 1.2 MB).
 */
const CACHE = "auditkosh-v4";
// NOTE: bump CACHE when pdf.worker.min.mjs changes (a pdfjs-dist upgrade) so the
// precached worker can't go stale against a newer, mismatched pdf.js chunk.
// The app is now served by Next (not a static export), so the shell entry is
// just "/" — there's no standalone /index.html file to precache.
const SHELL = ["/", "/pdf.worker.min.mjs"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      // Per-asset (not addAll, which is atomic and aborts on any single failure).
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

function putInCache(req, res) {
  if (res && res.ok && res.type === "basic") {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const res = await fetch(req);
    putInCache(req, res);
    return res;
  } catch {
    return Response.error();
  }
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    putInCache(req, res);
    return res;
  } catch {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    // Navigation fallback: serve the cached app shell.
    return (
      (await caches.match("/", { ignoreSearch: true })) ||
      (await caches.match("/index.html", { ignoreSearch: true })) ||
      Response.error()
    );
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
  } else {
    // Hashed chunks + the version-pinned worker + small static assets.
    event.respondWith(cacheFirst(req));
  }
});
