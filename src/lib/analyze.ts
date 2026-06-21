import { analyze } from "./detect";
import { buildOverview, buildReceived } from "./overview";
import type { Analysis, RawTxn } from "./types";

/**
 * Run the full pipeline: subscription detection + spending overview on the
 * money OUT, plus a "received" summary from the money IN. Spending analysis
 * only ever sees outflows, so received transactions never inflate spend.
 */
export function runAnalysis(txns: RawTxn[], notes: string[] = []): Analysis {
  const outflows = txns.filter((t) => t.direction === "out");
  const inflows = txns.filter((t) => t.direction === "in");

  const audit = analyze(outflows, notes);
  const recurringIds = new Set(audit.subscriptions.map((s) => s.id));
  const overview = buildOverview(outflows, recurringIds);
  const received = buildReceived(inflows, overview.totalSpent);

  return { overview, audit, received };
}
