"use client";

import { useEffect, useState } from "react";
import { UploadIcon } from "./icons";

type BIPEvent = Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };

/**
 * "Install app" button for the PWA. Uses the browser's beforeinstallprompt
 * (Chrome/Edge/Android); on iOS Safari, which has no prompt, it shows the
 * Add-to-Home-Screen hint instead. Hides itself once installed or when the app
 * is already running standalone.
 */
export default function InstallButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  // One-time, client-only environment probe (done during render, per React's
  // guidance, rather than synchronously in an effect).
  const [probed, setProbed] = useState(false);
  if (!probed && typeof window !== "undefined") {
    setProbed(true);
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
    } else {
      const ua = navigator.userAgent || "";
      setIsIos(/iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios/i.test(ua));
    }
  }

  useEffect(() => {
    // Only attaches listeners; their setState runs later (async), not synchronously here.
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Nothing to offer: already installed, or a browser that can't install (and isn't iOS).
  if (installed || (!deferred && !isIos)) return null;

  const onClick = async () => {
    if (deferred) {
      deferred.prompt();
      await deferred.userChoice.catch(() => {});
      setDeferred(null);
    } else {
      setShowIosHint((v) => !v);
    }
  };

  return (
    <div className="mt-3 flex flex-col items-center gap-2">
      <button
        onClick={onClick}
        className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent-dim px-3.5 py-2 text-sm font-semibold text-accent transition hover:bg-accent hover:text-bg"
      >
        <UploadIcon className="h-4 w-4" /> Install app — use it offline, one tap
      </button>
      {showIosHint && (
        <p className="max-w-xs text-center text-xs text-muted">
          On iPhone: tap the <span className="font-medium text-text">Share</span> button, then{" "}
          <span className="font-medium text-text">Add to Home Screen</span>. It then opens like an
          app and works offline.
        </p>
      )}
    </div>
  );
}
