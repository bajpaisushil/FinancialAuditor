/**
 * Tiny shared store for "is the app fully cached for offline use yet?".
 *
 * The service worker warms the big lazy assets (the ~440KB PDF engine + its
 * 1.2MB worker) in the background after the first load. Until that finishes a
 * PDF dropped *after* going offline can't be parsed — so we surface the warming
 * state to the UI and let it show a shimmer/"preparing offline" hint, then a
 * "ready offline" confirmation. Read with useSyncExternalStore.
 */
export type OfflineReady = "idle" | "warming" | "ready";

let state: OfflineReady = "idle";
const listeners = new Set<() => void>();

export function getOfflineReady(): OfflineReady {
  return state;
}

export function setOfflineReady(next: OfflineReady): void {
  if (next === state) return;
  state = next;
  for (const l of listeners) l();
}

export function subscribeOfflineReady(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
