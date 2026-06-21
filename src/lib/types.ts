import type { Category } from "./categorize";

export interface RawTxn {
  date: Date;
  description: string;
  /** Always positive. Direction says whether it's money out or in. */
  amount: number;
  /** "out" = spent, "in" = received. */
  direction: "out" | "in";
}

export type Cadence =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export interface PriceHike {
  from: number;
  to: number;
  delta: number;
  pct: number;
  /** ISO date of the charge where the new price first appeared. */
  changedOn: string;
}

export interface Subscription {
  id: string;
  /** Cleaned, human-friendly merchant name. */
  merchant: string;
  /** A representative raw description from the statement. */
  rawSample: string;
  cadence: Cadence;
  /** Typical charge amount (most recent). */
  amount: number;
  /** Normalized to a monthly figure for comparison. */
  monthlyCost: number;
  annualCost: number;
  /** 0..1 — how confident we are this is truly recurring. */
  confidence: number;
  count: number;
  firstSeen: string;
  lastSeen: string;
  /** Median days between charges. */
  intervalDays: number;
  hike: PriceHike | null;
  charges: { date: string; amount: number }[];
}

export interface AuditResult {
  subscriptions: Subscription[];
  totalMonthly: number;
  totalAnnual: number;
  hikeCount: number;
  /** Extra annual cost created purely by price hikes. */
  hikeAnnualImpact: number;
  txnCount: number;
  dateRange: { from: string; to: string } | null;
  /** Non-fatal notes for the user (e.g. unparseable rows). */
  notes: string[];
}

/** One transaction in a merchant's history, surfaced to the UI. */
export interface MerchantTxn {
  date: string;
  amount: number;
}

/** Everything we know about spending at a single merchant. */
export interface MerchantSummary {
  id: string;
  name: string;
  rawSample: string;
  category: Category;
  total: number;
  count: number;
  avg: number;
  min: number;
  max: number;
  firstSeen: string;
  lastSeen: string;
  /** Days between first and last charge. */
  spanDays: number;
  /** A plain-English cadence, e.g. "almost daily", "weekly-ish". */
  rhythm: string;
  /** True if this merchant was also flagged as a recurring subscription. */
  isRecurring: boolean;
  txns: MerchantTxn[];
}

export interface CategoryTotal {
  category: Category;
  total: number;
  count: number;
  /** Share of total spend, 0..100. */
  pct: number;
}

export interface MonthlyPoint {
  /** "2025-03" */
  month: string;
  /** "Mar" or "Mar '25" */
  label: string;
  total: number;
}

export interface SpendingOverview {
  totalSpent: number;
  txnCount: number;
  merchantCount: number;
  dateRange: { from: string; to: string } | null;
  monthsCovered: number;
  avgPerMonth: number;
  categories: CategoryTotal[];
  /** All merchants, sorted by total spend descending. */
  merchants: MerchantSummary[];
  monthly: MonthlyPoint[];
  topMerchant: MerchantSummary | null;
  biggestCategory: CategoryTotal | null;
}

/** Money coming in (deposits, salary, transfers received, refunds). */
export interface ReceivedSummary {
  total: number;
  count: number;
  /** received − spent. Positive = you took in more than you spent. */
  net: number;
  monthly: MonthlyPoint[];
  /** Who money came from, sorted by total descending. */
  sources: MerchantSummary[];
}

/** The full result of analyzing one statement. */
export interface Analysis {
  overview: SpendingOverview;
  audit: AuditResult;
  received: ReceivedSummary;
}
