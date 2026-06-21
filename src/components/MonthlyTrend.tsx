"use client";

import type { MonthlyPoint } from "@/lib/types";
import { money } from "@/lib/format";

export default function MonthlyTrend({ monthly }: { monthly: MonthlyPoint[] }) {
  if (monthly.length === 0) return null;
  const max = Math.max(...monthly.map((m) => m.total), 1);
  const avg = monthly.reduce((s, m) => s + m.total, 0) / monthly.length;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Spending by month</h3>
        <span className="text-xs text-faint tabular">avg {money(avg, { cents: false })}/mo</span>
      </div>

      <div className="mt-5 flex h-40 items-end gap-2">
        {monthly.map((m) => {
          const h = Math.max(4, (m.total / max) * 100);
          return (
            <div key={m.month} className="group flex flex-1 flex-col items-center justify-end gap-2">
              <span className="text-[10px] font-medium text-muted opacity-0 transition group-hover:opacity-100 tabular">
                {money(m.total, { cents: false })}
              </span>
              <div className="relative flex w-full justify-center" style={{ height: `${h}%` }}>
                <div className="w-full max-w-10 rounded-t-md bg-gradient-to-t from-accent-deep/40 to-accent transition group-hover:from-accent-deep/60" />
              </div>
              <span className="text-[10px] text-faint">{m.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
