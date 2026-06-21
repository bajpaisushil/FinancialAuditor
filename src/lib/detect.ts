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

/** Words that are never the actual payee — transaction plumbing and bank codes. */
const NAME_STOPWORDS = new Set([
  "upi", "neft", "imps", "rtgs", "ach", "pos", "atm", "emi", "ecs", "nach",
  "dr", "cr", "ref", "txn", "trn", "id", "no", "rrn", "payment", "pmt", "pay",
  "paid", "sent", "received", "recd", "rcvd", "money", "added", "transfer",
  "transferred", "trf", "tfr", "to", "from", "via", "by", "the", "for", "of",
  "account", "ac", "acct", "bank", "wallet", "recharge", "bill", "billpay",
  "autopay", "mandate", "purchase", "debit", "credit", "online", "mobile",
  "app", "fund", "funds", "transaction", "self", "and",
  // Common Indian bank short/IFSC-prefix codes
  "hdfc", "icic", "icici", "sbin", "sbi", "axis", "utib", "kotak", "kkbk",
  "pnb", "punb", "bob", "barb", "yesb", "idfc", "idfb", "indb", "ibkl",
  "ubin", "cnrb", "canara", "federal", "fdrl", "rbl", "ratn", "indusind",
  "induslnd", "citi", "hsbc", "scbl", "dbs", "aubl", "bandhan", "okhdfcbank",
  "okaxis", "okicici", "oksbi", "ybl", "paytm", "apl", "ibl",
]);

function looksLikeId(t: string): boolean {
  // Long all-caps/alnum refs, or tokens with several digits.
  if (/^\d+$/.test(t)) return true;
  const digits = (t.match(/\d/g) || []).length;
  return digits >= 4 || (digits > 0 && digits >= t.length / 2);
}

function titleCaseName(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .slice(0, 40)
    .trim();
}

/** Last-resort identifier: a UPI VPA local-part or a 10-digit phone. */
function vpaOrPhone(str: string): string | null {
  const vpa = str.match(/([a-z0-9][a-z0-9.\-]{1,})@[a-z]{2,}/i);
  if (vpa && !NAME_STOPWORDS.has(vpa[1].toLowerCase())) return vpa[1];
  const phone = str.match(/\b(\d{10})\b/);
  if (phone) return phone[1];
  return null;
}

/** Clean a candidate name: drop stopwords/ids, keep the human part. */
function cleanName(raw: string): string | null {
  const tokens = raw
    .replace(/@\S+/g, " ") // drop UPI handles like @okhdfcbank
    .split(/[^A-Za-z&.]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const kept: string[] = [];
  for (const t of tokens) {
    const lw = t.toLowerCase().replace(/\./g, "");
    if (!lw) continue;
    if (NAME_STOPWORDS.has(lw)) continue;
    if (looksLikeId(t)) continue;
    if (t.length === 1) continue;
    kept.push(t);
    if (kept.length >= 4) break;
  }
  if (kept.length === 0) return null;
  return kept.join(" ");
}

/** Score a delimited segment on how much it looks like a real payee name. */
function pickNameSegment(segments: string[]): string | null {
  let best: string | null = null;
  let bestScore = 0;
  for (const seg of segments) {
    const cand = cleanName(seg);
    if (!cand) continue;
    const words = cand.split(/\s+/);
    let score = words.length;
    if (cand.includes(" ")) score += 2; // multi-word ≈ a person/company name
    if (cand.length >= 4) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return best;
}

/**
 * Pull the actual payee name out of transfer-style narrations
 * (UPI / NEFT / IMPS / "paid to" / "received from"). Returns null otherwise.
 */
function extractPayeeName(s: string): string | null {
  // Explicit verbs: "Paid to Ramesh Kumar", "Received from Jane", "Sent to X"
  const verb = s.match(
    /(?:paid to|sent to|payment to|transferred to|transfer to|money sent to|received from|money received from|recd from|rcvd from|to a\/?c of)\s+(.+?)(?:\s+(?:on|ref|upi|txn|id|via|a\/?c|account|dated)\b|[,/|]|$)/i
  );
  if (verb) {
    const cand = cleanName(verb[1]);
    if (cand) return cand;
    const id = vpaOrPhone(verb[1]);
    if (id) return id;
  }

  // Structured UPI/NEFT/IMPS, usually delimited by "/", "-" or "|".
  if (/\b(upi|neft|imps|rtgs|ach|p2a|p2m)\b/i.test(s) || s.split("/").length >= 3) {
    const segs = s.split(/[\/|]|\s-\s|-/);
    const cand = pickNameSegment(segs);
    if (cand) return cand;
    const id = vpaOrPhone(s);
    if (id) return id;
  }

  return null;
}

/** Strip transaction noise and produce a stable grouping key + display name. */
export function normalizeMerchant(raw: string): { key: string; name: string } {
  const cleaned = raw.replace(/\s+/g, " ").trim();

  // First, try to surface the real payee from a transfer-style narration.
  const payee = extractPayeeName(cleaned);
  if (payee) {
    const name = titleCaseName(payee);
    if (name) return { key: name.toLowerCase(), name };
  }

  // Fallback: token-based cleanup for card/merchant descriptors.
  let s = cleaned.toLowerCase();
  s = s.replace(/https?:\/\/\S+/g, " ");
  s = s.replace(/\b[\w.-]+@[\w.-]+\b/g, " ");
  s = s.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, " ");
  s = s.replace(/\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/g, " ");
  s = s.replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, " ");

  const tokens = s.split(/[^a-z0-9&]+/).filter(Boolean);

  const kept: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t) continue;
    if (/^\d+$/.test(t)) continue;
    if (/\d/.test(t) && t.length >= 4) continue;
    if (NOISE_TOKENS.has(t)) continue;
    if (kept.length >= 1 && STATE_CODES.has(t) && i >= tokens.length - 2) continue;
    if (t.length === 1 && kept.length >= 1) continue;
    kept.push(t);
    if (kept.length >= 4) break;
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
  // Format the LOCAL calendar date — toISOString() would shift a day backward
  // in timezones ahead of UTC (e.g. IST), corrupting every date we show.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
