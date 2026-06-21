import type { Cadence } from "./types";

/**
 * The active display currency, set once per analyzed statement (see Auditor).
 * A module-level value keeps every component formatting consistently without
 * threading the currency through dozens of props.
 */
let activeCurrency = "USD";

export function setCurrency(code: string) {
  activeCurrency = code;
}
export function getCurrency(): string {
  return activeCurrency;
}

export function money(n: number, opts: { cents?: boolean } = {}): string {
  const noCents = opts.cents === false;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: activeCurrency,
    // Let zero-decimal currencies (JPY, etc.) keep their natural precision;
    // only force 0 digits when the caller explicitly wants whole numbers.
    ...(noCents
      ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
      : {}),
  }).format(n);
}

export function cadenceLabel(c: Cadence): string {
  return {
    weekly: "Weekly",
    biweekly: "Every 2 weeks",
    monthly: "Monthly",
    quarterly: "Quarterly",
    yearly: "Yearly",
  }[c];
}

export function cadenceShort(c: Cadence): string {
  return {
    weekly: "/wk",
    biweekly: "/2wk",
    monthly: "/mo",
    quarterly: "/qtr",
    yearly: "/yr",
  }[c];
}

export function prettyDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
