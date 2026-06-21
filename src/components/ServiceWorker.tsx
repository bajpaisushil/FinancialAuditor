"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker (production builds only). Once it's
 * installed and has precached the app, everything — including the in-browser
 * PDF engine — works with the network fully disconnected.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);
  return null;
}
