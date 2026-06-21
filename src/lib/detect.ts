import type { AuditResult, Cadence, PriceHike, RawTxn, Subscription } from "./types";

/** Banking noise tokens to strip when deriving a clean merchant name. */
const NOISE_TOKENS = new Set([
  "pos", "purchase", "debit", "card", "visa", "mastercard", "amex", "ach",
  "payment", "pmt", "recurring", "autopay", "auto", "pay", "bill", "billpay",
  "online", "web", "mobile", "app", "transaction", "trans", "ref", "id",
  "authorized", "auth", "on", "the", "inc", "llc", "ltd", "co", "corp",
  "usa", "us", "intl", "international", "tfr", "dda", "withdrawal",
  "checkcard", "ckcd", "sq", "tst", "dd", "paypal", "ppl",
]);

/** Common 2-letter US state codes that show up as trailing location noise. */
const STATE_CODES = new Set([
  "al","ak","az","ar","ca","co","ct","de","fl","ga","hi","id","il","in","ia",
  "ks","ky","la","me","md","ma","mi","mn","ms","mo","mt","ne","nv","nh","nj",
  "nm","ny","nc","nd","oh","ok","or","pa","ri","sc","sd","tn","tx","ut","vt",
  "va","wa","wv","wi","wy",
]);

/** Strip transaction noise and produce a stable grouping key + display name. */
export function normalizeMerchant(raw: string): { key: string; name: string } {
  let s = raw.toLowerCase();

  // Remove URLs, emails, phone numbers.
  s = s.replace(/https?:\/\/\S+/g, " ");
  s = s.replace(/\b[\w.-]+@[\w.-]+\b/g, " ");
  s = s.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, " ");

  // Remove dates and times embedded in descriptions.
  s = s.replace(/\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/g, " ");
  s = s.replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, " ");

  // Split into tokens on non-alphanumerics.
  const tokens = s.split(/[^a-z0-9&]+/).filter(Boolean);

  const kept: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    let t = tokens[i];
    if (!t) continue;
    // Drop pure numbers and long alphanumeric ids (store #, ref ids).
    if (/^\d+$/.test(t)) continue;
    if (/\d/.test(t) && t.length >= 4) continue; // mixed id-like token
    if (NOISE_TOKENS.has(t)) continue;
    // Drop trailing state codes when we already have a name.
    if (kept.length >= 1 && STATE_CODES.has(t) && i >= tokens.length - 2) continue;
    if (t.length === 1 && kept.length >= 1) continue;
    kept.push(t);
    if (kept.length >= 4) break; // first few words carry the brand
  }

  const finalTokens = kept.length ? kept : tokens.slice(0, 2);
  const key = finalTokens.join(" ").trim() || s.trim() || raw.toLowerCase().trim();
  const name = finalTokens
    .map((t) => (t.length <= 3 ? t.toUpperCase() : t[0].toUpperCase() + t.slice(1)))
    .join(" ");
  return { key, name: name || raw.trim() };
}

const DAY = 24 * 60 * 60 * 1000;

interface CadenceDef {
  cadence: Cadence;
  days: number;
  min: number;
  max: number;
  perMonth: number;
}

const CADENCES: CadenceDef[] = [
  { cadence: "weekly", days: 7, min: 5, max: 9, perMonth: 52 / 12 },
  { cadence: "biweekly", days: 14, min: 11, max: 18, perMonth: 26 / 12 },
  { cadence: "monthly", days: 30, min: 24, max: 38, perMonth: 1 },
  { cadence: "quarterly", days: 91, min: 80, max: 100, perMonth: 1 / 3 },
  { cadence: "yearly", days: 365, min: 330, max: 400, perMonth: 1 / 12 },
];

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function classifyCadence(intervalDays: number): CadenceDef | null {
  for (const c of CADENCES) {
    if (intervalDays >= c.min && intervalDays <= c.max) return c;
  }
  return null;
}

function detectHike(charges: { date: string; amount: number }[]): PriceHike | null {
  if (charges.length < 2) return null;
  const first = charges[0].amount;
  let prev = first;
  for (let i = 1; i < charges.length; i++) {
    const a = charges[i].amount;
    const delta = a - prev;
    // A real hike: > $0.50 and > 2% jump that sticks.
    if (delta > 0.5 && delta / prev > 0.02) {
      return {
        from: prev,
        to: a,
        delta,
        pct: (delta / prev) * 100,
        changedOn: charges[i].date,
      };
    }
    prev = a;
  }
  return null;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Full audit pipeline: group, score recurrence, detect hikes, total up. */
export function analyze(txns: RawTxn[], notes: string[] = []): AuditResult {
  const groups = new Map<string, { name: string; rawSample: string; txns: RawTxn[] }>();

  for (const t of txns) {
    const { key, name } = normalizeMerchant(t.description);
    if (!key) continue;
    const g = groups.get(key);
    if (g) g.txns.push(t);
    else groups.set(key, { name, rawSample: t.description, txns: [t] });
  }

  const subscriptions: Subscription[] = [];

  for (const [key, g] of groups) {
    const sorted = [...g.txns].sort((a, b) => a.date.getTime() - b.date.getTime());
    if (sorted.length < 2) continue; // need repetition

    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push((sorted[i].date.getTime() - sorted[i - 1].date.getTime()) / DAY);
    }
    const medInterval = median(intervals);
    const def = classifyCadence(medInterval);
    if (!def) continue;

    // Regularity: how tightly intervals cluster around the cadence.
    const spread = median(intervals.map((d) => Math.abs(d - def.days)));
    const regularity = Math.max(0, 1 - spread / def.days);

    // Amount consistency: low coefficient of variation = consistent subscription.
    const amounts = sorted.map((t) => t.amount);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((a, b) => a + (b - mean) ** 2, 0) / amounts.length;
    const cv = mean ? Math.sqrt(variance) / mean : 1;
    const amountConsistency = Math.max(0, 1 - cv); // 1 = identical charges

    // More occurrences => more confident.
    const countScore = Math.min(1, (sorted.length - 1) / 4); // saturates at ~5 charges

    const confidence = clamp01(
      0.5 * regularity + 0.3 * amountConsistency + 0.2 * countScore
    );

    // Require a sane floor so one-off coincidences don't show up.
    if (confidence < 0.45) continue;

    const charges = sorted.map((t) => ({ date: iso(t.date), amount: round2(t.amount) }));
    const latest = sorted[sorted.length - 1].amount;
    const monthlyCost = latest * def.perMonth;
    const hike = detectHike(charges);

    subscriptions.push({
      id: key,
      merchant: g.name,
      rawSample: g.rawSample,
      cadence: def.cadence,
      amount: round2(latest),
      monthlyCost: round2(monthlyCost),
      annualCost: round2(monthlyCost * 12),
      confidence: round2(confidence),
      count: sorted.length,
      firstSeen: charges[0].date,
      lastSeen: charges[charges.length - 1].date,
      intervalDays: Math.round(medInterval),
      hike,
      charges,
    });
  }

  subscriptions.sort((a, b) => b.monthlyCost - a.monthlyCost);

  const totalMonthly = subscriptions.reduce((s, x) => s + x.monthlyCost, 0);
  const hikes = subscriptions.filter((s) => s.hike);
  const hikeAnnualImpact = hikes.reduce((s, x) => {
    const def = CADENCES.find((c) => c.cadence === x.cadence)!;
    return s + (x.hike!.delta * def.perMonth * 12);
  }, 0);

  const allDates = txns.map((t) => t.date.getTime());
  const dateRange =
    allDates.length > 0
      ? { from: iso(new Date(Math.min(...allDates))), to: iso(new Date(Math.max(...allDates))) }
      : null;

  return {
    subscriptions,
    totalMonthly: round2(totalMonthly),
    totalAnnual: round2(totalMonthly * 12),
    hikeCount: hikes.length,
    hikeAnnualImpact: round2(hikeAnnualImpact),
    txnCount: txns.length,
    dateRange,
    notes,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
