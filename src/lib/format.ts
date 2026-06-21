import type { Cadence } from "./types";

export function money(n: number, opts: { cents?: boolean } = {}): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts.cents === false ? 0 : 2,
    maximumFractionDigits: opts.cents === false ? 0 : 2,
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
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
