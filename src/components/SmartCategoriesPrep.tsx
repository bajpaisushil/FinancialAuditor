"use client";

import { useState, useSyncExternalStore } from "react";
import { getAiModel, getAiModelServer, subscribeAiModel } from "@/lib/ai/modelStatus";
import { BoltIcon, ShieldIcon } from "./icons";

/**
 * Lets the user download the on-device categorization model BEFORE analyzing —
 * i.e. while they're still online. The model (~25 MB) can't be fetched once
 * offline, so offering it only on the results screen is useless to anyone who
 * dropped a PDF after disconnecting. Once cached here, categorization just works
 * later, even offline (the dashboard auto-applies it).
 */
export default function SmartCategoriesPrep() {
  const model = useSyncExternalStore(subscribeAiModel, getAiModel, getAiModelServer);
  const [busy, setBusy] = useState(false);

  const downloading = model.status === "downloading";
  const ready = model.status === "ready";
  const error = model.status === "error";

  const enable = async () => {
    if (busy || downloading || ready) return;
    setBusy(true);
    try {
      const { warmupModel } = await import("@/lib/ai/categorizeAI");
      await warmupModel();
    } catch {
      /* status store is now "error"; the button shows Retry */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl border border-border bg-surface px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <BoltIcon className={`mt-0.5 h-4 w-4 shrink-0 ${ready ? "text-accent" : "text-faint"}`} />
        <div>
          <p className="text-sm font-medium">
            Smarter categories{" "}
            <span className="text-xs font-normal text-faint">· optional, on-device AI</span>
          </p>
          <p className={`text-xs ${error ? "text-danger" : "text-faint"}`}>
            {error
              ? "Couldn't download the model. Reconnect and try again."
              : ready
                ? "Downloaded & cached — it'll auto-sort your statement, even offline."
                : "Grab the ~25 MB model now, while you're online, so categories work later even offline. Your data never leaves the device."}
          </p>
        </div>
      </div>
      {ready ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-dim px-3 py-2 text-sm font-semibold text-accent">
          <ShieldIcon className="h-4 w-4" /> Ready offline
        </span>
      ) : (
        <button
          onClick={enable}
          disabled={downloading || busy}
          className="shrink-0 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-bg transition hover:bg-accent-deep disabled:opacity-70"
        >
          {downloading ? `Downloading… ${model.progress || 0}%` : error ? "Retry" : "Download for offline"}
        </button>
      )}
    </div>
  );
}
