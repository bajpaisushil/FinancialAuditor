import type { RawTxn } from "./types";
import { parseAmount, parseDate, type ParseOptions } from "./parser";
import { detectCurrencyFromText } from "./locale";

export interface PdfParseOutput {
  txns: RawTxn[];
  notes: string[];
  currency: string | null;
}

/** A money figure on a statement line: digits with two decimals, optional symbol/sign. */
const MONEY_RE = /[-+]?[₹$£€]?\s?\d{1,3}(?:,\d{2,3})*\.\d{2}(?:\s?(?:cr|dr))?|[-+]?[₹$£€]?\s?\d+\.\d{2}(?:\s?(?:cr|dr))?/gi;

/** Find the first date-looking token in a line. */
const DATE_RE =
  /\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[-\s][A-Za-z]{3,9}[-\s]\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})\b/;

/** Reconstruct visual text lines from positioned PDF text items. */
function itemsToLines(items: { str: string; transform: number[] }[]): string[] {
  const rows = new Map<number, { x: number; str: string }[]>();
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = Math.round(it.transform[5]);
    // Snap to an existing row within a few units to absorb baseline jitter.
    let key = y;
    for (const k of rows.keys()) {
      if (Math.abs(k - y) <= 3) {
        key = k;
        break;
      }
    }
    const arr = rows.get(key) ?? [];
    arr.push({ x: it.transform[4], str: it.str });
    rows.set(key, arr);
  }

  return [...rows.entries()]
    .sort(([a], [b]) => b - a) // PDF origin is bottom-left → higher y first
    .map(([, parts]) =>
      parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
}

/** Heuristically pull transactions out of statement text lines. */
export function parseStatementLines(lines: string[], opts: ParseOptions = {}): PdfParseOutput {
  const dayFirst = opts.dayFirst ?? true;
  const currency = detectCurrencyFromText(lines.join("\n"));
  const txns: RawTxn[] = [];
  let candidates = 0;

  for (const line of lines) {
    const dateMatch = line.match(DATE_RE);
    if (!dateMatch) continue;
    const date = parseDate(dateMatch[0], dayFirst);
    if (!date) continue;

    const moneyTokens = line.match(MONEY_RE);
    if (!moneyTokens || moneyTokens.length === 0) continue;
    candidates++;

    // First money figure is almost always the transaction amount;
    // any trailing figure is the running balance.
    const amount = parseAmount(moneyTokens[0]);
    if (amount === null || amount === 0) continue;

    const low = line.toLowerCase();
    const firstTok = moneyTokens[0].toLowerCase();

    // Direction: explicit credit markers mean money in → not spending.
    const isInflow =
      /\bcr\b|\bcredit\b|deposit|salary|refund|interest|cashback|received/.test(low) ||
      firstTok.includes("cr") ||
      (firstTok.includes("+") && !firstTok.includes("-"));
    if (isInflow) continue;

    // Build a clean description: strip the date and the money tokens out.
    let desc = line.replace(dateMatch[0], " ");
    for (const m of moneyTokens) desc = desc.replace(m, " ");
    desc = desc.replace(/\b(dr|cr|debit|credit|balance|bal)\b/gi, " ").replace(/\s+/g, " ").trim();
    if (desc.length < 2) continue;

    txns.push({ date, description: desc, amount: Math.abs(amount) });
  }

  const notes: string[] = [];
  if (txns.length === 0) {
    notes.push(
      candidates > 0
        ? "We read the PDF but couldn't line up the columns. PDFs vary wildly — a CSV export will give far more accurate results."
        : "This looks like a scanned or image-only PDF with no selectable text. Try a CSV export, or a PDF you can highlight text in."
    );
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
  /** True when a password was supplied but rejected. */
  incorrect: boolean;
  constructor(message: string, incorrect = false) {
    super(message);
    this.name = "PdfPasswordError";
    this.incorrect = incorrect;
  }
}

/**
 * Extract transactions from a PDF entirely in the browser via pdf.js.
 * Pass `password` for encrypted PDFs.
 */
export async function parsePdf(
  file: File,
  opts: ParseOptions = {},
  password?: string
): Promise<PdfParseOutput> {
  const pdfjs = await import("pdfjs-dist");

  // pdf.js v6 ships an ES-module worker; instantiate it as a module worker
  // ourselves from our own /public file (no external request is ever made).
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
      // code 2 = INCORRECT_PASSWORD, 1 = NEED_PASSWORD (pdfjs PasswordResponses).
      const incorrect = (err as { code?: number }).code === 2;
      throw new PdfPasswordError(
        incorrect ? "Incorrect password." : "This PDF is password-protected.",
        incorrect
      );
    }
    throw err;
  }

  const allLines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: { str: string; transform: number[] }[] = [];
    for (const i of content.items) {
      // TextItem has `str`; TextMarkedContent does not.
      if ("str" in i) items.push({ str: i.str, transform: i.transform });
    }
    allLines.push(...itemsToLines(items));
  }
  await task.destroy();

  return parseStatementLines(allLines, opts);
}
