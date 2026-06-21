"use client";

import { useSyncExternalStore } from "react";
import { getOfflineReady, subscribeOfflineReady } from "@/lib/offlineReady";
import { ShieldIcon } from "./icons";

/**
 * Surfaces the service worker's offline warm-up so a user knows when it's safe
 * to disconnect. While the big assets (PDF engine + worker) download we show a
 * shimmering "saving for offline" pill; once cached it flips to "ready offline".
 * Renders nothing until warming starts (dev, SSR, or SW-unsupported).
 */
export default function OfflineReadyPill() {
  const state = useSyncExternalStore(
    subscribeOfflineReady,
    getOfflineReady,
    () => "idle" as const
  );

  if (state === "idle") return null;

  if (state === "warming") {
    return (
      <span
        className="relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted"
        title="Downloading the bits that let this work offline. Hang on a moment before disconnecting."
      >
        <span className="pointer-events-none absolute inset-0 shimmer" aria-hidden />
        <span className="relative h-3 w-3 animate-spin rounded-full border-[1.5px] border-accent/30 border-t-accent" />
        <span className="relative">Saving for offline…</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-dim px-2.5 py-1 text-xs font-medium text-accent"
      title="The whole app (incl. the PDF engine) is cached. You can disconnect and it still works."
    >
      <ShieldIcon className="h-3.5 w-3.5" /> Ready offline
    </span>
  );
}
