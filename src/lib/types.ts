export interface RawTxn {
  date: Date;
  description: string;
  /** Positive number = money spent (outflow). */
  amount: number;
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
