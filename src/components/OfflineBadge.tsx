"use client";

import { useEffect, useState } from "react";
import { WifiOffIcon } from "./icons";

/** Live network status. The whole pitch is that going offline changes nothing. */
export default function OfflineBadge() {
  const [online, setOnline] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!mounted) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tabular ${
        online
          ? "border-border bg-surface text-muted"
          : "border-accent/40 bg-accent-dim text-accent"
      }`}
      title={online ? "You're online — but nothing is being sent." : "You're offline and it still works. That's the point."}
    >
      <WifiOffIcon className="h-3.5 w-3.5" />
      {online ? "Wi-Fi on · still 0 bytes sent" : "Offline · still working"}
    </span>
  );
}
