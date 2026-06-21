"use client";

import { useCallback, useRef, useState } from "react";
import { parseCsv } from "@/lib/parser";
import { runAnalysis } from "@/lib/analyze";
import { sampleCsv } from "@/lib/sample";
import type { Analysis } from "@/lib/types";
import SpendingDashboard from "./SpendingDashboard";
import SupportModal from "./SupportModal";
import OfflineBadge from "./OfflineBadge";
import { BoltIcon, FileIcon, LockIcon, UploadIcon } from "./icons";

type State =
  | { phase: "idle" }
  | { phase: "working" }
  | { phase: "error"; message: string }
  | { phase: "done"; analysis: Analysis; fileName: string };

export default function Auditor() {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [dragging, setDragging] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const nudged = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = useCallback((text: string, fileName: string) => {
    setState({ phase: "working" });
    // Defer so the "working" state paints before the (synchronous) crunch.
    setTimeout(() => {
      try {
        const { txns, notes } = parseCsv(text);
        const analysis = runAnalysis(txns, notes);
        setState({ phase: "done", analysis, fileName });
        // One gentle, dismissible support nudge after the first real result.
        if (!nudged.current && analysis.overview.txnCount > 0) {
          nudged.current = true;
          setTimeout(() => setShowSupport(true), 1600);
        }
      } catch {
        setState({
          phase: "error",
          message: "We couldn't read that file. Make sure it's a CSV export from your bank.",
        });
      }
    }, 350);
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (!/\.csv$|\.txt$/i.test(file.name) && file.type !== "text/csv") {
        setState({
          phase: "error",
          message: "Please drop a .csv file (most banks let you export one).",
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => run(String(reader.result || ""), file.name);
      reader.onerror = () =>
        setState({ phase: "error", message: "Couldn't read that file off your disk." });
      reader.readAsText(file);
    },
    [run]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const annualSavings =
    state.phase === "done" ? state.analysis.audit.totalAnnual : 0;

  return (
    <div id="auditor" className="mx-auto w-full max-w-3xl scroll-mt-24">
      <SupportModal
        open={showSupport}
        onClose={() => setShowSupport(false)}
        annualSavings={annualSavings}
      />

      {state.phase === "done" ? (
        <SpendingDashboard
          analysis={state.analysis}
          onReset={() => setState({ phase: "idle" })}
          onSupport={() => setShowSupport(true)}
        />
      ) : (
        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
            className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${
              dragging
                ? "border-accent bg-accent-dim/40"
                : "border-border bg-surface hover:border-accent/50 hover:bg-surface-2"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />

            {state.phase === "working" ? (
              <>
                <div className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-accent-dim text-accent">
                  <BoltIcon className="h-7 w-7" />
                  <span className="absolute inset-0 rounded-xl shimmer" />
                </div>
                <p className="mt-4 font-medium">Scanning on your device…</p>
                <p className="mt-1 text-sm text-muted">
                  Matching merchants, measuring intervals, catching price hikes.
                </p>
              </>
            ) : (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent-dim text-accent transition group-hover:scale-105">
                  <UploadIcon className="h-7 w-7" />
                </div>
                <p className="mt-4 text-lg font-medium">
                  {dragging ? "Drop it — it never leaves this tab" : "Drag your bank statement here"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  or <span className="font-medium text-accent">browse for a .csv</span> · processed 100% in your browser
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-soft px-2.5 py-1 text-muted">
                    <LockIcon className="h-3.5 w-3.5" /> No upload
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-soft px-2.5 py-1 text-muted">
                    <FileIcon className="h-3.5 w-3.5" /> No account
                  </span>
                  <OfflineBadge />
                </div>
              </>
            )}
          </div>

          {state.phase === "error" && (
            <p className="mt-3 rounded-lg border border-danger/30 bg-danger-dim/40 px-4 py-2.5 text-sm text-danger">
              {state.message}
            </p>
          )}

          <div className="mt-4 flex items-center justify-center gap-3 text-sm">
            <span className="text-faint">Don&apos;t have a file handy?</span>
            <button
              onClick={() => run(sampleCsv(), "sample-statement.csv")}
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              Try it with sample data →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
