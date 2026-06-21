// Generates out/sw.js — a service worker that precaches the entire static
// export so the app works fully offline after the first visit (the core
// "turn your Wi-Fi off" promise). Runs as `postbuild`.
import { readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "out");

if (!existsSync(outDir)) {
  console.warn("⚠ out/ not found — skipping service worker generation.");
  process.exit(0);
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}

const assets = walk(outDir)
  .map((p) => "/" + relative(outDir, p).split(/[\\/]/).join("/"))
  .filter((u) => u !== "/sw.js" && !u.endsWith(".map"));

const urls = Array.from(new Set(["/", ...assets]));
const version = "v" + Date.now();

const sw = `/* Auto-generated offline service worker — do not edit. Regenerated each build. */
const CACHE = "auditkosh-${version}";
const ASSETS = ${JSON.stringify(urls)};

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never touch cross-origin requests (e.g. host telemetry) — let them fail on their own.
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
`;

writeFileSync(join(outDir, "sw.js"), sw);
console.log(`✓ Generated out/sw.js (${urls.length} assets precached for offline use)`);
