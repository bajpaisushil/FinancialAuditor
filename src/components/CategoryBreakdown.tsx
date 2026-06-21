"use client";

import { CATEGORY_META } from "@/lib/categorize";
import type { CategoryTotal } from "@/lib/types";
import { money } from "@/lib/format";

export default function CategoryBreakdown({ categories }: { categories: CategoryTotal[] }) {
  if (categories.length === 0) return null;
  const top = categories.slice(0, 8);
  const rest = categories.slice(8);
  const restTotal = rest.reduce((s, c) => s + c.total, 0);
  const restPct = rest.reduce((s, c) => s + c.pct, 0);

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="text-sm font-semibold">Where your money goes</h3>

      {/* Composition bar */}
      <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-surface-2">
        {categories.map((c) => (
          <div
            key={c.category}
            style={{ width: `${c.pct}%`, backgroundColor: CATEGORY_META[c.category].color }}
            title={`${CATEGORY_META[c.category].label} · ${c.pct}%`}
          />
        ))}
      </div>

      {/* Rows */}
      <div className="mt-5 space-y-3">
        {top.map((c) => {
          const meta = CATEGORY_META[c.category];
          return (
            <div key={c.category} className="flex items-center gap-3">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: meta.color }}
              />
              <span className="w-32 shrink-0 truncate text-sm">{meta.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(2, c.pct)}%`, backgroundColor: meta.color }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-sm font-medium tabular">
                {money(c.total, { cents: false })}
              </span>
              <span className="w-10 shrink-0 text-right text-xs text-faint tabular">
                {c.pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
        {rest.length > 0 && (
          <div className="flex items-center gap-3 text-faint">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-faint/50" />
            <span className="w-32 shrink-0 text-sm">+{rest.length} more</span>
            <div className="h-2 flex-1" />
            <span className="w-16 shrink-0 text-right text-sm tabular">
              {money(restTotal, { cents: false })}
            </span>
            <span className="w-10 shrink-0 text-right text-xs tabular">{restPct.toFixed(0)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
