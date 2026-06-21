"use client";

import { useState } from "react";
import type { Subscription } from "@/lib/types";
import { cadenceLabel, cadenceShort, money, prettyDate } from "@/lib/format";
import { ChevronIcon, RepeatIcon, TrendUpIcon } from "./icons";

function confidenceTone(c: number): { label: string; cls: string } {
  if (c >= 0.8) return { label: "High confidence", cls: "text-accent" };
  if (c >= 0.6) return { label: "Likely", cls: "text-accent/80" };
  return { label: "Possible", cls: "text-warn" };
}

export default function SubscriptionCard({ sub }: { sub: Subscription }) {
  const [open, setOpen] = useState(false);
  const conf = confidenceTone(sub.confidence);
  const max = Math.max(...sub.charges.map((c) => c.amount));

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface transition hover:border-border/80">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            sub.hike ? "bg-warn-dim text-warn" : "bg-accent-dim text-accent"
          }`}
        >
          {sub.hike ? <TrendUpIcon className="h-5 w-5" /> : <RepeatIcon className="h-5 w-5" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{sub.merchant}</span>
            {sub.hike && (
              <span className="shrink-0 rounded-full bg-warn-dim px-2 py-0.5 text-[10px] font-semibold text-warn">
                +{sub.hike.pct.toFixed(0)}% hike
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-faint">
            <span className={conf.cls}>{conf.label}</span>
            <span>·</span>
            <span>{cadenceLabel(sub.cadence)}</span>
            <span>·</span>
            <span>{sub.count} charges</span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="font-semibold tabular">
            {money(sub.amount)}
            <span className="text-xs font-normal text-faint">{cadenceShort(sub.cadence)}</span>
          </div>
          <div className="text-xs text-muted tabular">{money(sub.monthlyCost)}/mo</div>
        </div>

        <ChevronIcon
          className={`h-4 w-4 shrink-0 text-faint transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-border-soft bg-bg-soft/50 p-4">
          {sub.hike && (
            <div className="mb-4 rounded-lg border border-warn/30 bg-warn-dim/40 p-3 text-sm">
              <span className="font-medium text-warn">Price went up.</span>{" "}
              <span className="text-muted">
                From {money(sub.hike.from)} to {money(sub.hike.to)} on{" "}
                {prettyDate(sub.hike.changedOn)} — that&apos;s{" "}
                {money(sub.hike.delta)} more each charge.
              </span>
            </div>
          )}

          <div className="mb-4 grid grid-cols-3 gap-3 text-center">
            <Stat label="Per year" value={money(sub.annualCost)} />
            <Stat label="Every" value={`${sub.intervalDays} days`} />
            <Stat label="Since" value={prettyDate(sub.firstSeen)} small />
          </div>

          <div className="space-y-1.5">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">
              Charge history
            </div>
            {sub.charges.map((c, i) => {
              const isHike = sub.hike && c.date === sub.hike.changedOn;
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-xs text-faint tabular">
                    {prettyDate(c.date)}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full ${isHike ? "bg-warn" : "bg-accent/60"}`}
                      style={{ width: `${Math.max(8, (c.amount / max) * 100)}%` }}
                    />
                  </div>
                  <span
                    className={`w-16 shrink-0 text-right tabular ${isHike ? "font-semibold text-warn" : ""}`}
                  >
                    {money(c.amount)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-xs text-faint">
            <span className="text-muted">As it appears on your statement: </span>
            <span className="font-mono">{sub.rawSample}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2 py-2.5">
      <div className={`font-semibold tabular ${small ? "text-xs" : "text-sm"}`}>{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-faint">{label}</div>
    </div>
  );
}
