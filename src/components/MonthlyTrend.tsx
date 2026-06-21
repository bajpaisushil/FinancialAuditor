"use client";

import type { MonthlyPoint } from "@/lib/types";
import { money } from "@/lib/format";

export default function MonthlyTrend({
  monthly,
  title = "Spending by month",
}: {
  monthly: MonthlyPoint[];
  title?: string;
}) {
  if (monthly.length === 0) return null;
  const max = Math.max(...monthly.map((m) => m.total), 1);
  const avg = monthly.reduce((s, m) => s + m.total, 0) / monthly.length;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-faint tabular">avg {money(avg, { cents: false })}/mo</span>
      </div>

      {/* Bars — each column is full-height so the % bar height has a definite parent. */}
      <div className="mt-5 flex h-40 items-end gap-1.5">
        {monthly.map((m) => {
          const h = max > 0 ? Math.max(3, Math.round((m.total / max) * 100)) : 0;
          return (
            <div
              key={m.month}
              title={`${m.label}: ${money(m.total, { cents: false })}`}
              className="group flex h-full flex-1 items-end justify-center"
            >
              <div
                className="w-full max-w-10 rounded-t-md bg-gradient-to-t from-accent-deep/50 to-accent transition group-hover:to-accent group-hover:from-accent-deep"
                style={{ height: `${h}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Month labels, aligned to the bars above. */}
      <div className="mt-1.5 flex gap-1.5">
        {monthly.map((m) => (
          <div key={m.month} className="flex-1 truncate text-center text-[10px] text-faint">
            {m.label}
          </div>
        ))}
      </div>
    </div>
  );
}
