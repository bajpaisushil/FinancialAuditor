import { classify, type Category } from "./categorize";
import { normalizeMerchant } from "./detect";
import type {
  CategoryTotal,
  MerchantSummary,
  MonthlyPoint,
  RawTxn,
  ReceivedSummary,
  SpendingOverview,
} from "./types";

const DAY = 24 * 60 * 60 * 1000;

/** Roll per-merchant categories up into ranked category totals (shared by the AI re-categorizer). */
export function aggregateCategories(merchants: MerchantSummary[], totalSpent: number): CategoryTotal[] {
  const map = new Map<Category, { total: number; count: number }>();
  for (const m of merchants) {
    const ct = map.get(m.category) ?? { total: 0, count: 0 };
    ct.total += m.total;
    ct.count += m.count;
    map.set(m.category, ct);
  }
  return [...map.entries()]
    .map(([category, v]) => ({
      category,
      total: Math.round(v.total * 100) / 100,
      count: v.count,
      pct: totalSpent ? Math.round((v.total / totalSpent) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

function iso(d: Date): string {
  // Local calendar date — see note in detect.ts; avoids an off-by-one in
  // timezones ahead of UTC.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Turn count + span into language a human reads at a glance. */
function rhythmLabel(count: number, spanDays: number): string {
  if (count < 2) return "one-time";
  const gap = spanDays / (count - 1);
  if (gap <= 1.6) return "almost daily";
  if (gap <= 3.5) return "several times a week";
  if (gap <= 10) return "about weekly";
  if (gap <= 20) return "a couple times a month";
  if (gap <= 45) return "about monthly";
  if (gap <= 120) return "every few months";
  return "occasionally";
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Build the full spending picture from raw outflows.
 * `recurringIds` are merchant keys already flagged as subscriptions, so the
 * dashboard can tag them without re-running detection.
 */
export function buildOverview(txns: RawTxn[], recurringIds: Set<string>): SpendingOverview {
  const groups = new Map<string, { name: string; rawSample: string; txns: RawTxn[] }>();

  for (const t of txns) {
    const { key, name } = normalizeMerchant(t.description);
    if (!key) continue;
    const g = groups.get(key);
    if (g) g.txns.push(t);
    else groups.set(key, { name, rawSample: t.description, txns: [t] });
  }

  const merchants: MerchantSummary[] = [];
  const monthMap = new Map<string, number>();
  let totalSpent = 0;

  for (const [key, g] of groups) {
    const sorted = [...g.txns].sort((a, b) => a.date.getTime() - b.date.getTime());
    const amounts = sorted.map((t) => t.amount);
    const total = amounts.reduce((a, b) => a + b, 0);
    const count = sorted.length;
    const first = sorted[0].date;
    const last = sorted[count - 1].date;
    const spanDays = Math.round((last.getTime() - first.getTime()) / DAY);

    // Pick the category most of this merchant's spend falls into.
    const byCat = new Map<Category, number>();
    for (const t of sorted) {
      const c = classify(t.description);
      byCat.set(c, (byCat.get(c) ?? 0) + t.amount);
    }
    let category: Category = "other";
    let best = -1;
    for (const [c, v] of byCat) {
      if (v > best) {
        best = v;
        category = c;
      }
    }

    merchants.push({
      id: key,
      name: g.name,
      rawSample: g.rawSample,
      category,
      total: round2(total),
      count,
      avg: round2(total / count),
      min: round2(Math.min(...amounts)),
      max: round2(Math.max(...amounts)),
      firstSeen: iso(first),
      lastSeen: iso(last),
      spanDays,
      rhythm: rhythmLabel(count, spanDays),
      isRecurring: recurringIds.has(key),
      txns: sorted.map((t) => ({ date: iso(t.date), amount: round2(t.amount) })),
    });

    totalSpent += total;

    for (const t of sorted) {
      const mk = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(mk, (monthMap.get(mk) ?? 0) + t.amount);
    }
  }

  merchants.sort((a, b) => b.total - a.total);

  const categories = aggregateCategories(merchants, round2(totalSpent));

  const monthly: MonthlyPoint[] = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => {
      const [y, m] = month.split("-");
      return {
        month,
        label: `${MONTHS[+m - 1]} '${y.slice(2)}`,
        total: round2(total),
      };
    });

  const allDates = txns.map((t) => t.date.getTime());
  const dateRange =
    allDates.length > 0
      ? { from: iso(new Date(Math.min(...allDates))), to: iso(new Date(Math.max(...allDates))) }
      : null;

  const monthsCovered = Math.max(1, monthMap.size);

  return {
    totalSpent: round2(totalSpent),
    txnCount: txns.length,
    merchantCount: merchants.length,
    dateRange,
    monthsCovered,
    avgPerMonth: round2(totalSpent / monthsCovered),
    categories,
    merchants,
    monthly,
    topMerchant: merchants[0] ?? null,
    biggestCategory: categories[0] ?? null,
  };
}

/** Summarize money coming in: total, net vs spend, monthly series, and sources. */
export function buildReceived(inflows: RawTxn[], totalSpent: number): ReceivedSummary {
  const groups = new Map<string, { name: string; rawSample: string; txns: RawTxn[] }>();
  for (const t of inflows) {
    const { key, name } = normalizeMerchant(t.description);
    if (!key) continue;
    const g = groups.get(key);
    if (g) g.txns.push(t);
    else groups.set(key, { name, rawSample: t.description, txns: [t] });
  }

  const sources: MerchantSummary[] = [];
  const monthMap = new Map<string, number>();
  let total = 0;

  for (const [key, g] of groups) {
    const sorted = [...g.txns].sort((a, b) => a.date.getTime() - b.date.getTime());
    const amounts = sorted.map((t) => t.amount);
    const sum = amounts.reduce((a, b) => a + b, 0);
    const first = sorted[0].date;
    const last = sorted[sorted.length - 1].date;
    const spanDays = Math.round((last.getTime() - first.getTime()) / DAY);
    sources.push({
      id: key,
      name: g.name,
      rawSample: g.rawSample,
      category: classify(g.rawSample),
      total: round2(sum),
      count: sorted.length,
      avg: round2(sum / sorted.length),
      min: round2(Math.min(...amounts)),
      max: round2(Math.max(...amounts)),
      firstSeen: iso(first),
      lastSeen: iso(last),
      spanDays,
      rhythm: rhythmLabel(sorted.length, spanDays),
      isRecurring: false,
      txns: sorted.map((t) => ({ date: iso(t.date), amount: round2(t.amount) })),
    });
    total += sum;
    for (const t of sorted) {
      const mk = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(mk, (monthMap.get(mk) ?? 0) + t.amount);
    }
  }

  sources.sort((a, b) => b.total - a.total);
  const monthly: MonthlyPoint[] = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, t]) => {
      const [y, m] = month.split("-");
      return { month, label: `${MONTHS[+m - 1]} '${y.slice(2)}`, total: round2(t) };
    });

  return {
    total: round2(total),
    count: inflows.length,
    net: round2(total - totalSpent),
    monthly,
    sources,
  };
}
