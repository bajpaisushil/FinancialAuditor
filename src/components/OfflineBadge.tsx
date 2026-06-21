"use client";

import { useSyncExternalStore } from "react";
import { WifiOffIcon } from "./icons";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Live network status. The whole pitch is that going offline changes nothing. */
export default function OfflineBadge() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine, // client
    () => true // server snapshot (assume online during SSR)
  );

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tabular ${
        online
          ? "border-border bg-surface text-muted"
          : "border-accent/40 bg-accent-dim text-accent"
      }`}
      title={
        online
          ? "You're online — but nothing is being sent."
          : "You're offline and it still works. That's the point."
      }
    >
      <WifiOffIcon className="h-3.5 w-3.5" />
      {online ? "Online · still 0 bytes sent" : "Offline · still working"}
    </span>
  );
}
