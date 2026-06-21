"use client";

import { useState } from "react";
import { CATEGORY_META } from "@/lib/categorize";
import type { MerchantSummary } from "@/lib/types";
import { money, prettyDate } from "@/lib/format";
import { ChevronIcon, RepeatIcon } from "./icons";

/** A one-sentence, human summary — the "you spent X over Y days at Z" line. */
function insight(m: MerchantSummary): string {
  if (m.count === 1) {
    return `A single charge of ${money(m.total)} on ${prettyDate(m.firstSeen)}.`;
  }
  const span =
    m.spanDays >= 1
      ? `over ${m.spanDays} day${m.spanDays === 1 ? "" : "s"}`
      : "in a single day";
  return `${m.count} visits ${span} — ${m.rhythm} — totalling ${money(
    m.total
  )}, about ${money(m.avg)} each time.`;
}

export default function MerchantCard({ merchant: m }: { merchant: MerchantSummary }) {
  const [open, setOpen] = useState(false);
  const meta = CATEGORY_META[m.category];
  const max = Math.max(...m.txns.map((t) => t.amount), 1);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface transition hover:border-border/80">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 p-4 text-left">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
          style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
        >
          {m.name.slice(0, 2).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{m.name}</span>
            {m.isRecurring && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-dim px-1.5 py-0.5 text-[10px] font-medium text-accent">
                <RepeatIcon className="h-3 w-3" /> sub
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-faint">
            <span style={{ color: meta.color }}>{meta.label}</span>
            <span>·</span>
            <span>{m.count}×</span>
            <span>·</span>
            <span>{m.rhythm}</span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="font-semibold tabular">{money(m.total)}</div>
          <div className="text-xs text-faint tabular">~{money(m.avg)} ea</div>
        </div>

        <ChevronIcon className={`h-4 w-4 shrink-0 text-faint transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border-soft bg-bg-soft/50 p-4">
          <p className="text-sm text-muted">{insight(m)}</p>

          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            <MiniStat label="Total" value={money(m.total, { cents: false })} />
            <MiniStat label="Charges" value={String(m.count)} />
            <MiniStat label="Smallest" value={money(m.min, { cents: false })} />
            <MiniStat label="Largest" value={money(m.max, { cents: false })} />
          </div>

          <div className="mt-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
              Every charge ({prettyDate(m.firstSeen)} – {prettyDate(m.lastSeen)})
            </div>
            <div className="max-h-60 space-y-1.5 overflow-y-auto scroll-slim pr-1">
              {m.txns.map((t, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-xs text-faint tabular">{prettyDate(t.date)}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(6, (t.amount / max) * 100)}%`, backgroundColor: meta.color }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right tabular">{money(t.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-xs text-faint">
            <span className="text-muted">On your statement: </span>
            <span className="font-mono">{m.rawSample}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2 py-2">
      <div className="text-sm font-semibold tabular">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-faint">{label}</div>
    </div>
  );
}
