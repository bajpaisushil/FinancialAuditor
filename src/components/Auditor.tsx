"use client";

import { useCallback, useRef, useState } from "react";
import { parseCsv } from "@/lib/parser";
import { parsePdf, PdfPasswordError } from "@/lib/pdf";
import { runAnalysis } from "@/lib/analyze";
import { sampleCsv } from "@/lib/sample";
import { detectRegion, isDayFirstRegion, regionCurrency } from "@/lib/locale";
import { setCurrency } from "@/lib/format";
import type { Analysis, RawTxn } from "@/lib/types";
import SpendingDashboard from "./SpendingDashboard";
import SupportModal from "./SupportModal";
import OfflineBadge from "./OfflineBadge";
import { BoltIcon, FileIcon, LockIcon, UploadIcon } from "./icons";

type State =
  | { phase: "idle" }
  | { phase: "working" }
  | { phase: "password"; file: File; incorrect: boolean }
  | { phase: "error"; message: string }
  | { phase: "done"; analysis: Analysis; fileName: string };

export default function Auditor() {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [dragging, setDragging] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [password, setPassword] = useState("");
  const nudged = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Shared tail end: analyze parsed transactions and show results.
  const finish = useCallback((txns: RawTxn[], notes: string[], fileName: string) => {
    const analysis = runAnalysis(txns, notes);
    setState({ phase: "done", analysis, fileName });
    // One gentle, dismissible support nudge after the first real result.
    if (!nudged.current && analysis.overview.txnCount > 0) {
      nudged.current = true;
      setTimeout(() => setShowSupport(true), 1600);
    }
  }, []);

  const runCsv = useCallback(
    (text: string, fileName: string) => {
      setState({ phase: "working" });
      // Defer so the "working" state paints before the (synchronous) crunch.
      setTimeout(() => {
        try {
          const region = detectRegion();
          const { txns, notes, currency } = parseCsv(text, {
            dayFirst: isDayFirstRegion(region),
          });
          setCurrency(currency ?? regionCurrency(region));
          finish(txns, notes, fileName);
        } catch {
          setState({
            phase: "error",
            message: "We couldn't read that file. Make sure it's a CSV export from your bank.",
          });
        }
      }, 350);
    },
    [finish]
  );

  const runPdf = useCallback(
    async (file: File, pw?: string) => {
      setState({ phase: "working" });
      try {
        const region = detectRegion();
        const { txns, notes, currency } = await parsePdf(
          file,
          { dayFirst: isDayFirstRegion(region), referenceYear: new Date().getFullYear() },
          pw
        );
        setCurrency(currency ?? regionCurrency(region));
        if (txns.length === 0) {
          setState({
            phase: "error",
            message: notes[0] ?? "We couldn't find any transactions in that PDF.",
          });
          return;
        }
        finish(txns, notes, file.name);
      } catch (err) {
        if (err instanceof PdfPasswordError) {
          // Ask for a password (or flag the one just tried as wrong).
          setState({ phase: "password", file, incorrect: err.incorrect });
          return;
        }
        console.error("PDF parse failed:", err);
        const message =
          err instanceof Error && err.message
            ? `We couldn't read that PDF (${err.message}). A CSV export is the most reliable.`
            : "We couldn't read that PDF. If it's a scanned image, try a CSV export instead.";
        setState({ phase: "error", message });
      }
    },
    [finish]
  );

  const submitPassword = useCallback(() => {
    if (state.phase !== "password" || !password.trim()) return;
    const file = state.file;
    setPassword("");
    runPdf(file, password);
  }, [state, password, runPdf]);

  const handleFile = useCallback(
    (file: File) => {
      const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
      const isCsv = /\.csv$|\.txt$/i.test(file.name) || file.type === "text/csv";

      if (isPdf) {
        runPdf(file);
        return;
      }
      if (!isCsv) {
        setState({
          phase: "error",
          message: "Please drop a CSV or PDF statement (most banks let you export one).",
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => runCsv(String(reader.result || ""), file.name);
      reader.onerror = () =>
        setState({ phase: "error", message: "Couldn't read that file off your disk." });
      reader.readAsText(file);
    },
    [runCsv, runPdf]
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
      ) : state.phase === "password" ? (
        <div className="animate-rise rounded-2xl border border-border bg-surface p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-accent-dim text-accent">
            <LockIcon className="h-7 w-7" />
          </div>
          <p className="mt-4 text-lg font-medium">This PDF is locked</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Enter its password to open it. The password is used right here in your
            browser and never sent anywhere.
          </p>
          <div className="mx-auto mt-5 flex max-w-xs flex-col gap-2.5">
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitPassword()}
              placeholder="PDF password"
              className={`w-full rounded-lg border bg-bg-soft px-4 py-2.5 text-center text-sm outline-none transition placeholder:text-faint focus:border-accent/60 ${
                state.incorrect ? "border-danger/60" : "border-border"
              }`}
            />
            {state.incorrect && (
              <p className="text-xs text-danger">Incorrect password — try again.</p>
            )}
            <button
              onClick={submitPassword}
              disabled={!password.trim()}
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition hover:bg-accent-deep disabled:opacity-40"
            >
              Unlock &amp; scan
            </button>
            <button
              onClick={() => {
                setPassword("");
                setState({ phase: "idle" });
              }}
              className="w-full rounded-lg px-4 py-2 text-sm font-medium text-muted transition hover:text-text"
            >
              Cancel
            </button>
          </div>
        </div>
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
              accept=".csv,.pdf,text/csv,text/plain,application/pdf"
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
                  or <span className="font-medium text-accent">browse for a CSV or PDF</span> · processed 100% in your browser
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-soft px-2.5 py-1 text-muted">
                    <LockIcon className="h-3.5 w-3.5" /> No upload
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-soft px-2.5 py-1 text-muted">
                    <FileIcon className="h-3.5 w-3.5" /> CSV or PDF
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
              onClick={() => runCsv(sampleCsv(), "sample-statement.csv")}
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
