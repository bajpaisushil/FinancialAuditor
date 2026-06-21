"use client";

import { useEffect } from "react";
import { setOfflineReady } from "@/lib/offlineReady";

/**
 * Registers the offline service worker (production only) and, once it's ready,
 * warms the lazy PDF engine + worker into the cache while we're online. Those
 * are only fetched when a PDF is dropped, so without warming they'd never be
 * cached and a PDF parse would fail the moment the network is off — even though
 * the rest of the app works offline.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const warm = async () => {
      // Wait until the SW actually CONTROLS this page. On a first visit it
      // claims control a beat after `ready` resolves; fetching before then
      // bypasses the SW, so the chunk never lands in the durable SW cache.
      for (let i = 0; i < 60 && !navigator.serviceWorker.controller; i++) await sleep(100);
      if (!navigator.serviceWorker.controller) return;

      // Tell the UI we're pulling the offline assets down so it can show a
      // "preparing offline" shimmer until everything is cached.
      setOfflineReady("warming");

      // PRIORITY: the lazy PDF engine (~440 KB) and its worker (~1.2 MB). They
      // are the largest, slowest things to fetch and the ones a user is most
      // likely to need offline, yet they're never loaded on a normal visit —
      // so kick them off FIRST and let them download while we re-cache the rest.
      // Same dynamic import specifier as lib/pdf.ts → same chunk, so this caches
      // the exact engine a later parse will request.
      const pdfEngine = Promise.allSettled([
        import("pdfjs-dist").catch(() => {}),
        fetch("/pdf.worker.min.mjs").catch(() => {}),
      ]);

      // Re-fetch every same-origin asset THIS page already loaded (its JS/CSS
      // chunks, fonts, the manifest…). On a first visit those were requested
      // before the SW took control, so they bypassed its cache. Pulling them
      // again now — while we're online and the SW is in charge — lands them in
      // the durable cache, so a later offline reload has the whole app shell,
      // not just the pre-rendered HTML. Without this, going offline after one
      // visit leaves a dead shell that can't hydrate.
      try {
        const assets = performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter((u) => u.startsWith(window.location.origin) && /\.(js|mjs|css|woff2?|json|svg)(\?|$)/i.test(u));
        await Promise.allSettled([...new Set(assets)].map((u) => fetch(u).catch(() => {})));
      } catch {
        /* performance API or fetch unavailable — non-fatal */
      }

      await pdfEngine; // make sure the engine has finished caching before we idle

      // Everything a PDF parse needs is now in the durable cache — safe offline.
      setOfflineReady("ready");
    };

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        if (typeof window.requestIdleCallback === "function") {
          window.requestIdleCallback(() => void warm(), { timeout: 5000 });
        } else {
          window.setTimeout(() => void warm(), 2000);
        }
      } catch {
        /* SW unsupported or blocked — the app still works online. */
      }
    };

    if (document.readyState === "complete") {
      register();
    } else {
      const onLoad = () => register();
      window.addEventListener("load", onLoad, { once: true });
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  return null;
}
