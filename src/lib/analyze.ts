import { analyze } from "./detect";
import { buildOverview } from "./overview";
import type { Analysis, RawTxn } from "./types";

/**
 * Run the full pipeline on parsed transactions: subscription detection plus
 * the whole-statement spending overview. Both group merchants the same way,
 * so subscriptions line up with their merchant summaries.
 */
export function runAnalysis(txns: RawTxn[], notes: string[] = []): Analysis {
  const audit = analyze(txns, notes);
  const recurringIds = new Set(audit.subscriptions.map((s) => s.id));
  const overview = buildOverview(txns, recurringIds);
  return { overview, audit };
}
