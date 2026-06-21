import type { RawTxn } from "./types";
import { parseAmount, parseDate, type ParseOptions } from "./parser";
import { detectCurrencyFromText } from "./locale";

export interface PdfParseOutput {
  txns: RawTxn[];
  notes: string[];
  currency: string | null;
}

/** A money figure: digits with optional separators / symbol / sign / Dr-Cr. */
const MONEY_RE =
  /[-+]?\s?[₹$£€]?\s?\d{1,3}(?:,\d{2,3})*\.\d{2}(?:\s?(?:cr|dr))?|[-+]?\s?[₹$£€]?\s?\d+\.\d{2}(?:\s?(?:cr|dr))?/gi;

/** A whole cell that is just a money figure (decimals optional, position disambiguates). */
const MONEY_CELL_RE = /^[-+]?\s?[₹$£€]?\s?\d{1,3}(?:[,\s]\d{2,3})*(?:\.\d{1,2})?\s?(?:cr|dr)?$/i;

const DATE_RE =
  /\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[-\s][A-Za-z]{3,9}[-\s]\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})\b/;

const INFLOW_RE =
  /\bcr\b|\bcredit\b|deposit|salary|refund|interest|cashback|reversal|received|recd|rcvd|\bby\b|\binward\b/i;

const SKIP_ROW_RE =
  /\b(opening balance|closing balance|balance b\/?f|brought forward|carried forward|sub-?total|grand total|total\b|statement of|page \d|continued)\b/i;

interface Cell {
  x: number;
  str: string;
}
interface Row {
  y: number;
  cells: Cell[];
}

/** Group positioned text items into visual rows (sorted top→bottom, left→right). */
function itemsToRows(items: { str: string; transform: number[] }[]): Row[] {
  const buckets = new Map<number, Cell[]>();
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = Math.round(it.transform[5]);
    let key = y;
    for (const k of buckets.keys()) {
      if (Math.abs(k - y) <= 3) {
        key = k;
        break;
      }
    }
    const arr = buckets.get(key) ?? [];
    arr.push({ x: it.transform[4], str: it.str.trim() });
    buckets.set(key, arr);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => b - a)
    .map(([y, cells]) => ({ y, cells: cells.sort((a, b) => a.x - b.x) }));
}

function rowText(row: Row): string {
  return row.cells
    .map((c) => c.str)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

type ColKey = "date" | "desc" | "debit" | "credit" | "amount" | "balance";
type Columns = Partial<Record<ColKey, number>>;

const HEADER_PATTERNS: [ColKey, RegExp][] = [
  ["date", /^(date|txn date|transaction date|value date|posting date|tran date)$/i],
  ["desc", /^(description|narration|particulars|details|remarks|payee|merchant|naration)$/i],
  ["debit", /^(debit|withdrawal|withdrawals|withdrawl|dr|paid out|money out|amount\s*\(dr\))$/i],
  ["credit", /^(credit|deposit|deposits|cr|paid in|money in|amount\s*\(cr\))$/i],
  ["amount", /^(amount|amt|transaction amount)$/i],
  ["balance", /^(balance|closing balance|running balance|bal)$/i],
];

/** Detect a header row and the x-position of each known column. */
function detectColumns(row: Row): Columns | null {
  const cols: Columns = {};
  let hits = 0;
  for (const cell of row.cells) {
    const label = cell.str.trim();
    for (const [key, re] of HEADER_PATTERNS) {
      if (cols[key] === undefined && re.test(label)) {
        cols[key] = cell.x;
        hits++;
        break;
      }
    }
  }
  const hasMoneyCol = cols.debit !== undefined || cols.credit !== undefined || cols.amount !== undefined;
  if (hits >= 2 && (cols.date !== undefined || cols.desc !== undefined) && hasMoneyCol) {
    return cols;
  }
  return null;
}

function parseAmountCell(str: string): number | null {
  if (!MONEY_CELL_RE.test(str.trim())) return null;
  return parseAmount(str);
}

/** Column-aware extraction: map each money cell to its column by x-position. */
function parseWithColumns(rows: Row[], cols: Columns, dayFirst: boolean): RawTxn[] {
  const moneyCols: [ColKey, number][] = (["debit", "credit", "amount", "balance"] as ColKey[])
    .filter((k) => cols[k] !== undefined)
    .map((k) => [k, cols[k]!]);

  const txns: RawTxn[] = [];
  let lastDate: Date | null = null;

  for (const row of rows) {
    const text = rowText(row);
    if (SKIP_ROW_RE.test(text)) continue;

    // Date: prefer a cell near the date column, else any date token, else carry forward.
    let date: Date | null = null;
    const dm = text.match(DATE_RE);
    if (dm) {
      const d = parseDate(dm[0], dayFirst);
      if (d) {
        date = d;
        lastDate = d;
      }
    }
    if (!date) date = lastDate;

    // Assign each money cell to its nearest money column.
    const assigned: Partial<Record<ColKey, number>> = {};
    for (const cell of row.cells) {
      const v = parseAmountCell(cell.str);
      if (v === null) continue;
      let bestKey: ColKey | null = null;
      let bestDist = Infinity;
      for (const [key, x] of moneyCols) {
        const d = Math.abs(cell.x - x);
        if (d < bestDist) {
          bestDist = d;
          bestKey = key;
        }
      }
      if (bestKey && bestDist < 140) assigned[bestKey] = v;
    }

    if (!date) continue;

    let outflow: number | null = null;
    if (cols.debit !== undefined || cols.credit !== undefined) {
      if (assigned.debit && assigned.debit !== 0) outflow = Math.abs(assigned.debit);
      else continue; // a credit (or empty) row — not spending
    } else if (assigned.amount && assigned.amount !== 0) {
      // Single amount column: skip rows that are clearly credits/inflows.
      if (INFLOW_RE.test(text)) continue;
      outflow = Math.abs(assigned.amount);
    }
    if (outflow === null) continue;

    // Description: drop the date token and every money cell.
    let desc = text.replace(dm ? dm[0] : "", " ");
    for (const cell of row.cells) {
      if (parseAmountCell(cell.str) !== null) desc = desc.replace(cell.str, " ");
    }
    desc = desc.replace(/\b(dr|cr|debit|credit|balance|bal)\b/gi, " ").replace(/\s+/g, " ").trim();
    if (desc.length < 2) continue;

    txns.push({ date, description: desc, amount: outflow });
  }
  return txns;
}

/** Fallback: line-based heuristic with carry-forward dates for multi-line rows. */
export function parseStatementLines(lines: string[], opts: ParseOptions = {}): PdfParseOutput {
  const dayFirst = opts.dayFirst ?? true;
  const currency = detectCurrencyFromText(lines.join("\n"));
  const txns: RawTxn[] = [];
  let lastDate: Date | null = null;

  for (const line of lines) {
    if (SKIP_ROW_RE.test(line)) continue;

    const dateMatch = line.match(DATE_RE);
    if (dateMatch) {
      const d = parseDate(dateMatch[0], dayFirst);
      if (d) lastDate = d;
    }

    const moneyTokens = line.match(MONEY_RE);
    if (!moneyTokens || moneyTokens.length === 0) continue;

    const date = (dateMatch && parseDate(dateMatch[0], dayFirst)) || lastDate;
    if (!date) continue;

    const amount = parseAmount(moneyTokens[0]);
    if (amount === null || amount === 0) continue;

    const low = line.toLowerCase();
    const firstTok = moneyTokens[0].toLowerCase();
    const isInflow = INFLOW_RE.test(low) || firstTok.includes("cr") || /\+\s?[₹$£€]?\d/.test(firstTok);
    if (isInflow) continue;

    let desc = line.replace(dateMatch ? dateMatch[0] : "", " ");
    for (const m of moneyTokens) desc = desc.replace(m, " ");
    desc = desc.replace(/\b(dr|cr|debit|credit|balance|bal)\b/gi, " ").replace(/\s+/g, " ").trim();
    if (desc.length < 2) continue;

    txns.push({ date, description: desc, amount: Math.abs(amount) });
  }

  return finalize(txns, lines, currency);
}

/** Build notes that honestly distinguish "scanned" from "couldn't line up columns". */
function finalize(txns: RawTxn[], lines: string[], currency: string | null): PdfParseOutput {
  const totalChars = lines.reduce((s, l) => s + l.length, 0);
  const notes: string[] = [];

  if (txns.length === 0) {
    if (totalChars < 200) {
      notes.push(
        "This looks like a scanned or image-only PDF with no selectable text. Try a CSV export, or a PDF whose text you can highlight."
      );
    } else {
      notes.push(
        "We read the text but couldn't recognize the transaction rows in this layout. A CSV export will be far more accurate — and please report the format so we can support it."
      );
    }
  } else {
    notes.push(
      `Read ${txns.length} transactions from the PDF. PDF parsing is best-effort — if anything looks off, a CSV export is more precise.`
    );
  }
  return { txns, notes, currency };
}

let workerConfigured = false;

/** Raised by pdf.js when a PDF needs a password (or the one given was wrong). */
export class PdfPasswordError extends Error {
  incorrect: boolean;
  constructor(message: string, incorrect = false) {
    super(message);
    this.name = "PdfPasswordError";
    this.incorrect = incorrect;
  }
}

/**
 * Extract transactions from a PDF entirely in the browser via pdf.js.
 * Tries column-aware extraction first, then a line heuristic. Pass `password`
 * for encrypted PDFs.
 */
export async function parsePdf(
  file: File,
  opts: ParseOptions = {},
  password?: string
): Promise<PdfParseOutput> {
  const pdfjs = await import("pdfjs-dist");

  if (!workerConfigured) {
    try {
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(
        new URL("/pdf.worker.min.mjs", window.location.origin),
        { type: "module" }
      );
    } catch {
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    }
    workerConfigured = true;
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data, password });

  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    if (err && typeof err === "object" && (err as { name?: string }).name === "PasswordException") {
      const incorrect = (err as { code?: number }).code === 2;
      throw new PdfPasswordError(incorrect ? "Incorrect password." : "This PDF is password-protected.", incorrect);
    }
    throw err;
  }

  const dayFirst = opts.dayFirst ?? true;
  const allRows: Row[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: { str: string; transform: number[] }[] = [];
    for (const i of content.items) {
      if ("str" in i) items.push({ str: i.str, transform: i.transform });
    }
    allRows.push(...itemsToRows(items));
  }
  await task.destroy();

  const lines = allRows.map(rowText).filter(Boolean);
  const currency = detectCurrencyFromText(lines.join("\n"));

  // 1) Column-aware pass if we can find a header.
  let columns: Columns | null = null;
  for (const row of allRows) {
    const c = detectColumns(row);
    if (c) {
      columns = c;
      break;
    }
  }
  if (columns) {
    const txns = parseWithColumns(allRows, columns, dayFirst);
    if (txns.length > 0) return finalize(txns, lines, currency);
  }

  // 2) Fall back to the line heuristic.
  const result = parseStatementLines(lines, opts);

  // Dev aid: if we found text but no rows, surface a sample to tune against.
  if (result.txns.length === 0 && lines.length > 0 && process.env.NODE_ENV !== "production") {
    console.warn(
      "[pdf] No transactions parsed. First lines extracted:\n" + lines.slice(0, 40).join("\n")
    );
  }
  return result;
}
