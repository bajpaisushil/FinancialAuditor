"use client";

import type { AuditResult } from "@/lib/types";
import { money } from "@/lib/format";
import SubscriptionCard from "./SubscriptionCard";
import { HeartIcon, RepeatIcon, TrendUpIcon, UploadIcon } from "./icons";

export default function ResultsDashboard({
  result,
  onReset,
  onSupport,
}: {
  result: AuditResult;
  onReset: () => void;
  onSupport: () => void;
}) {
  const empty = result.subscriptions.length === 0;

  return (
    <div className="animate-rise space-y-6">
      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          tone="accent"
          icon={<RepeatIcon className="h-5 w-5" />}
          value={String(result.subscriptions.length)}
          label="Recurring charges"
        />
        <StatCard
          tone="accent"
          value={money(result.totalMonthly, { cents: false })}
          label="Per month"
        />
        <StatCard
          tone="danger"
          value={money(result.totalAnnual, { cents: false })}
          label="Per year"
          sub="if nothing changes"
        />
        <StatCard
          tone="warn"
          icon={<TrendUpIcon className="h-5 w-5" />}
          value={String(result.hikeCount)}
          label="Price hikes"
          sub={result.hikeCount ? `+${money(result.hikeAnnualImpact, { cents: false })}/yr` : "none found"}
        />
      </div>

      {result.dateRange && (
        <p className="text-xs text-faint">
          Analyzed {result.txnCount.toLocaleString()} outgoing transactions from{" "}
          {result.dateRange.from} to {result.dateRange.to} — entirely on this device.
        </p>
      )}

      {result.notes.length > 0 && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3 text-xs text-muted">
          {result.notes.map((n, i) => (
            <div key={i}>· {n}</div>
          ))}
        </div>
      )}

      {/* The "you could save this" hook + support nudge */}
      {!empty && (
        <div className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-gradient-to-br from-accent-dim/50 to-transparent p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">
              Cancel what you don&apos;t use and you could save up to{" "}
              <span className="text-accent">{money(result.totalAnnual, { cents: false })}</span> a year.
            </p>
            <p className="mt-1 text-xs text-muted">
              This tool is free forever and never saw a byte of your data. If it helped, you can say thanks.
            </p>
          </div>
          <button
            onClick={onSupport}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-accent/40 bg-accent-dim px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent hover:text-bg"
          >
            <HeartIcon className="h-4 w-4" />
            Support it
          </button>
        </div>
      )}

      {/* Subscription list */}
      {empty ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="font-medium">No recurring charges detected.</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Either you&apos;re impressively subscription-free, or the file didn&apos;t
            include enough months for us to spot a pattern. Try a statement that spans
            3+ months.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {result.subscriptions.map((s) => (
            <SubscriptionCard key={s.id} sub={s} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-center pt-2">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-muted transition hover:border-accent/40 hover:text-text"
        >
          <UploadIcon className="h-4 w-4" />
          Analyze another statement
        </button>
      </div>
    </div>
  );
}

function StatCard({
  value,
  label,
  sub,
  icon,
  tone,
}: {
  value: string;
  label: string;
  sub?: string;
  icon?: React.ReactNode;
  tone: "accent" | "warn" | "danger";
}) {
  const toneCls = {
    accent: "text-accent",
    warn: "text-warn",
    danger: "text-danger",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
          {label}
        </span>
        {icon && <span className={toneCls}>{icon}</span>}
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular ${toneCls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-faint tabular">{sub}</div>}
    </div>
  );
}
