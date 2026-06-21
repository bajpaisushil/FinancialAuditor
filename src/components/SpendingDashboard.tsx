"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Analysis } from "@/lib/types";
import { CATEGORY_META, type Category } from "@/lib/categorize";
import { money } from "@/lib/format";
import { getAiModel, getAiModelServer, subscribeAiModel } from "@/lib/ai/modelStatus";
import CategoryBreakdown from "./CategoryBreakdown";
import MonthlyTrend from "./MonthlyTrend";
import MerchantCard from "./MerchantCard";
import SubscriptionCard from "./SubscriptionCard";
import { BoltIcon, HeartIcon, RepeatIcon, TrendUpIcon, UploadIcon } from "./icons";

type Tab = "overview" | "received" | "subscriptions" | "merchants";

export default function SpendingDashboard({
  analysis,
  onReset,
  onSupport,
}: {
  analysis: Analysis;
  onReset: () => void;
  onSupport: () => void;
}) {
  // `view` is what we render — either the instant keyword analysis or the
  // AI-enhanced one. Reset (during render, per React docs) whenever a new
  // statement is analyzed.
  const [view, setView] = useState<Analysis>(analysis);
  // Which analysis the AI enhancement has been successfully applied to (so the
  // toggle reads "on"), whether the user explicitly turned it off, and whether
  // a categorize pass is in flight.
  const [enhancedFor, setEnhancedFor] = useState<Analysis | null>(null);
  const [userOff, setUserOff] = useState(false);
  const [applying, setApplying] = useState(false);
  const attemptedFor = useRef<Analysis | null>(null);
  const [seen, setSeen] = useState<Analysis>(analysis);
  if (seen !== analysis) {
    setSeen(analysis);
    setView(analysis);
    setEnhancedFor(null);
    setUserOff(false);
  }

  // Shared model status — may already be "ready" if the user pre-downloaded the
  // model on the upload screen (the whole point: enable it while still online).
  const model = useSyncExternalStore(subscribeAiModel, getAiModel, getAiModelServer);
  const aiOn = enhancedFor === analysis;

  // Auto-apply the enhancement once the model is ready (and the user hasn't
  // turned it off). attemptedFor dedupes so a failed categorize doesn't loop.
  useEffect(() => {
    if (model.status !== "ready" || userOff || aiOn) return;
    if (attemptedFor.current === analysis) return;
    attemptedFor.current = analysis;
    let cancelled = false;
    setApplying(true);
    (async () => {
      try {
        const { enhanceAnalysis } = await import("@/lib/ai/categorizeAI");
        const enhanced = await enhanceAnalysis(analysis);
        if (!cancelled) {
          setView(enhanced);
          setEnhancedFor(analysis);
        }
      } catch {
        /* leave base categories in place; model status reflects the error */
      } finally {
        if (!cancelled) setApplying(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [model.status, userOff, aiOn, analysis]);

  const { overview, audit } = view;
  // `received` was added after the first release. Guard against an analysis
  // object that predates the field (e.g. one held in state across a hot
  // reload, or any future producer that forgets it) so we degrade to an empty
  // "received" view instead of white-screening.
  const received = view.received ?? {
    total: 0,
    count: 0,
    net: -overview.totalSpent,
    monthly: [],
    sources: [],
  };
  const [tab, setTab] = useState<Tab>("overview");

  const toggleAi = useCallback(async () => {
    if (model.status === "downloading" || applying) return;
    if (aiOn) {
      // Turn off — revert to the instant keyword analysis.
      setUserOff(true);
      setEnhancedFor(null);
      setView(analysis);
      return;
    }
    // Turn on (or retry). Clear the dedupe guard so the effect re-attempts, and
    // kick off the download if the model isn't cached yet — the effect applies
    // the enhancement once it's ready.
    attemptedFor.current = null;
    setUserOff(false);
    if (model.status !== "ready") {
      try {
        const { warmupModel } = await import("@/lib/ai/categorizeAI");
        await warmupModel();
      } catch {
        /* model status is now "error"; the button shows Retry */
      }
    }
  }, [model.status, applying, aiOn, analysis]);

  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const aiLabel = applying
    ? "Categorizing…"
    : model.status === "downloading"
      ? `Downloading… ${model.progress || 0}%`
      : aiOn
        ? "On ✓ — turn off"
        : model.status === "error"
          ? "Retry"
          : "Enable";
  const aiHint =
    model.status === "error"
      ? offline
        ? "You're offline — reconnect once to download the model, then it works offline."
        : "Couldn't load the model. Check your connection and hit Retry."
      : "Re-sorts the “Other” pile with a model that runs in your browser. Enabled once while online (~25 MB), it caches and works offline after. Your data never leaves the device.";

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "received", label: "Received", count: received.count },
    { key: "subscriptions", label: "Subscriptions", count: audit.subscriptions.length },
    { key: "merchants", label: "Merchants", count: overview.merchantCount },
  ];

  return (
    <div className="animate-rise space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Your spending report</h2>
          {overview.dateRange && (
            <p className="text-xs text-faint">
              {overview.txnCount.toLocaleString()} transactions ·{" "}
              {overview.dateRange.from} → {overview.dateRange.to} · analyzed on this device
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSupport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-dim px-3 py-2 text-sm font-medium text-accent transition hover:bg-accent hover:text-bg"
          >
            <HeartIcon className="h-4 w-4" /> Support
          </button>
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-muted transition hover:border-accent/40 hover:text-text"
          >
            <UploadIcon className="h-4 w-4" /> New file
          </button>
        </div>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          tone="danger"
          value={money(overview.totalSpent, { cents: false })}
          label="Total spent"
          sub={`${money(overview.avgPerMonth, { cents: false })}/mo · ${overview.merchantCount} merchants`}
        />
        <StatCard
          tone="accent"
          value={money(received.total, { cents: false })}
          label="Total received"
          sub={received.count ? `${received.count} credits` : "none found"}
        />
        <StatCard
          tone={received.net >= 0 ? "accent" : "danger"}
          value={`${received.net >= 0 ? "+" : "−"}${money(Math.abs(received.net), { cents: false })}`}
          label="Net (in − out)"
          sub={received.net >= 0 ? "more in than out" : "more out than in"}
        />
        <StatCard
          tone="warn"
          value={money(audit.totalAnnual, { cents: false })}
          label="Subscriptions / yr"
          sub={`${audit.subscriptions.length} recurring`}
        />
      </div>

      {/* On-device AI categorization (opt-in) */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <BoltIcon className={`mt-0.5 h-4 w-4 shrink-0 ${aiOn ? "text-accent" : "text-faint"}`} />
          <div>
            <p className="text-sm font-medium">
              Smarter categories{" "}
              <span className="text-xs font-normal text-faint">· on-device AI</span>
            </p>
            <p className={`text-xs ${model.status === "error" ? "text-danger" : "text-faint"}`}>{aiHint}</p>
          </div>
        </div>
        <button
          onClick={toggleAi}
          disabled={model.status === "downloading" || applying}
          className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:opacity-70 ${
            aiOn
              ? "border border-accent/40 bg-accent-dim text-accent hover:bg-accent hover:text-bg"
              : "bg-accent text-bg hover:bg-accent-deep"
          }`}
        >
          {aiLabel}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t.key ? "bg-accent-dim text-accent" : "text-muted hover:text-text"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] tabular ${
                  tab === t.key ? "bg-accent/20" : "bg-surface-2 text-faint"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <OverviewTab analysis={view} onSeeMerchants={() => setTab("merchants")} />
      )}
      {tab === "received" && <ReceivedTab analysis={view} />}
      {tab === "subscriptions" && (
        <SubscriptionsTab analysis={view} onSupport={onSupport} />
      )}
      {tab === "merchants" && <MerchantsTab analysis={view} />}
    </div>
  );
}

function OverviewTab({
  analysis,
  onSeeMerchants,
}: {
  analysis: Analysis;
  onSeeMerchants: () => void;
}) {
  const { overview } = analysis;
  const topMerchants = overview.merchants.slice(0, 6);

  return (
    <div className="space-y-4">
      {/* Plain-English takeaway */}
      {overview.biggestCategory && overview.topMerchant && (
        <div className="rounded-xl border border-accent/25 bg-gradient-to-br from-accent-dim/40 to-transparent p-5 text-sm leading-relaxed">
          Most of your money —{" "}
          <span className="font-semibold text-accent">
            {money(overview.biggestCategory.total, { cents: false })} (
            {overview.biggestCategory.pct.toFixed(0)}%)
          </span>{" "}
          — went to{" "}
          <span className="font-medium">{CATEGORY_META[overview.biggestCategory.category].label}</span>.
          Your single biggest merchant was{" "}
          <span className="font-medium">{overview.topMerchant.name}</span> at{" "}
          <span className="font-semibold">{money(overview.topMerchant.total, { cents: false })}</span>{" "}
          across {overview.topMerchant.count} charge{overview.topMerchant.count === 1 ? "" : "s"}.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryBreakdown categories={overview.categories} />
        <MonthlyTrend monthly={overview.monthly} />
      </div>

      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Top merchants</h3>
          <button
            onClick={onSeeMerchants}
            className="text-xs font-medium text-accent hover:underline"
          >
            See all {overview.merchantCount} →
          </button>
        </div>
        <div className="space-y-2.5">
          {topMerchants.map((m) => (
            <MerchantCard key={m.id} merchant={m} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ReceivedTab({ analysis }: { analysis: Analysis }) {
  const { received, overview } = analysis;

  if (received.count === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="font-medium">No incoming money found.</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          This statement only shows money going out, or its credits weren&apos;t recognized.
          Salary, deposits, refunds and transfers received would show up here.
        </p>
      </div>
    );
  }

  const topSources = received.sources.slice(0, 8);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-accent/25 bg-gradient-to-br from-accent-dim/40 to-transparent p-5 text-sm leading-relaxed">
        You received <span className="font-semibold text-accent">{money(received.total)}</span> and spent{" "}
        <span className="font-semibold">{money(overview.totalSpent)}</span> — a net of{" "}
        <span className={`font-semibold ${received.net >= 0 ? "text-accent" : "text-danger"}`}>
          {received.net >= 0 ? "+" : "−"}
          {money(Math.abs(received.net))}
        </span>
        {received.net >= 0 ? " in your favour." : " (you spent more than you took in)."}
      </div>

      <MonthlyTrend monthly={received.monthly} title="Received by month" />

      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Top sources</h3>
          <span className="text-xs text-faint">who money came from</span>
        </div>
        <div className="space-y-2.5">
          {topSources.map((s) => (
            <MerchantCard key={s.id} merchant={s} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SubscriptionsTab({
  analysis,
  onSupport,
}: {
  analysis: Analysis;
  onSupport: () => void;
}) {
  const { audit } = analysis;

  if (audit.subscriptions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="font-medium">No recurring charges detected.</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          Either you&apos;re impressively subscription-free, or the statement is too short to
          spot a pattern. Try one that spans 3+ months.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard tone="accent" icon={<RepeatIcon className="h-5 w-5" />} value={String(audit.subscriptions.length)} label="Recurring" />
        <StatCard tone="accent" value={money(audit.totalMonthly, { cents: false })} label="Per month" />
        <StatCard tone="danger" value={money(audit.totalAnnual, { cents: false })} label="Per year" />
        <StatCard
          tone="warn"
          icon={<TrendUpIcon className="h-5 w-5" />}
          value={String(audit.hikeCount)}
          label="Price hikes"
          sub={audit.hikeCount ? `+${money(audit.hikeAnnualImpact, { cents: false })}/yr` : "none"}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-gradient-to-br from-accent-dim/50 to-transparent p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          Cancel what you don&apos;t use and save up to{" "}
          <span className="font-semibold text-accent">{money(audit.totalAnnual, { cents: false })}</span> a year.{" "}
          <span className="text-muted">This tool is free and never saw your data.</span>
        </p>
        <button
          onClick={onSupport}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-accent/40 bg-accent-dim px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent hover:text-bg"
        >
          <HeartIcon className="h-4 w-4" /> Support it
        </button>
      </div>

      <div className="space-y-2.5">
        {audit.subscriptions.map((s) => (
          <SubscriptionCard key={s.id} sub={s} />
        ))}
      </div>
    </div>
  );
}

function MerchantsTab({ analysis }: { analysis: Analysis }) {
  const { overview } = analysis;
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Category | "all">("all");

  const presentCats = useMemo(
    () => overview.categories.map((c) => c.category),
    [overview.categories]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return overview.merchants.filter((m) => {
      if (cat !== "all" && m.category !== cat) return false;
      if (q && !m.name.toLowerCase().includes(q) && !m.rawSample.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [overview.merchants, query, cat]);

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a merchant (e.g. coffee, Amazon)…"
        className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm outline-none transition placeholder:text-faint focus:border-accent/50"
      />

      <div className="flex flex-wrap gap-2">
        <Chip active={cat === "all"} onClick={() => setCat("all")} label="All" />
        {presentCats.map((c) => (
          <Chip
            key={c}
            active={cat === c}
            onClick={() => setCat(c)}
            label={CATEGORY_META[c].label}
            color={CATEGORY_META[c].color}
          />
        ))}
      </div>

      <p className="text-xs text-faint">
        {filtered.length} of {overview.merchantCount} merchants
      </p>

      <div className="space-y-2.5">
        {filtered.map((m) => (
          <MerchantCard key={m.id} merchant={m} />
        ))}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
            No merchants match that filter.
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
        active ? "border-accent/50 bg-accent-dim text-accent" : "border-border bg-surface text-muted hover:text-text"
      }`}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </button>
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
  tone: "accent" | "warn" | "danger" | "text";
}) {
  const toneCls = {
    accent: "text-accent",
    warn: "text-warn",
    danger: "text-danger",
    text: "text-text",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-faint">{label}</span>
        {icon && <span className={toneCls}>{icon}</span>}
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular ${toneCls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-faint tabular">{sub}</div>}
    </div>
  );
}
