import type { RawTxn } from "./types";
import { type ParseOptions } from "./parser";
import { detectCurrencyFromText } from "./locale";

export interface PdfParseOutput {
  txns: RawTxn[];
  notes: string[];
  currency: string | null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
};

interface Marker {
  day: number;
  month: number;
  year: number | null;
  /** Characters consumed from the start of the line by the date. */
  len: number;
}

/** A statement-period header like "21 JUN'25 - 20 JUN'26" — never a transaction. */
const DATE_RANGE_RE =
  /\d{1,2}\s*[A-Za-z]{3,9}'?\s*\d{2,4}\s*(?:-|–|—|to)\s*\d{1,2}\s*[A-Za-z]{3,9}/i;

/** A line is a date marker when it STARTS with a recognizable date. */
function parseDateMarker(line: string, dayFirst: boolean): Marker | null {
  if (DATE_RANGE_RE.test(line)) return null;
  // "20 Jun" / "20 Jun 2025" / "20 June 25" / "21 JUN'25"
  let m = line.match(/^\s*(\d{1,2})\s+([A-Za-z]{3,9})\.?(?:[\s']+(\d{2,4}))?\b/);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()];
    const day = +m[1];
    if (mon && day >= 1 && day <= 31) {
      let year = m[3] ? +m[3] : null;
      if (year !== null && year < 100) year += year < 70 ? 2000 : 1900;
      return { day, month: mon, year, len: m[0].length };
    }
  }
  // ISO: 2025-06-20
  m = line.match(/^\s*(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) return { year: +m[1], month: +m[2], day: +m[3], len: m[0].length };
  // DD/MM/YYYY or MM/DD/YYYY
  m = line.match(/^\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += y < 70 ? 2000 : 1900;
    const a = +m[1], b = +m[2];
    let day: number, mon: number;
    if (a > 12) { day = a; mon = b; }
    else if (b > 12) { mon = a; day = b; }
    else if (dayFirst) { day = a; mon = b; }
    else { mon = a; day = b; }
    return { day, month: mon, year: y, len: m[0].length };
  }
  return null;
}

interface Base {
  year: number;
  month: number;
  minYear: number;
  maxYear: number;
}

/** Most-recent year/month for inferring year-less dates, plus a year range to clamp to. */
function detectBase(headText: string, fallbackYear: number): Base {
  const m = headText.match(
    /(\d{1,2})\s*([A-Za-z]{3,9})'?\s*(\d{2,4})\s*(?:-|–|—|to)\s*(\d{1,2})\s*([A-Za-z]{3,9})'?\s*(\d{2,4})/i
  );
  if (m) {
    const endMon = MONTHS[m[5].toLowerCase()];
    let startYear = +m[3];
    if (startYear < 100) startYear += startYear < 70 ? 2000 : 1900;
    let endYear = +m[6];
    if (endYear < 100) endYear += endYear < 70 ? 2000 : 1900;
    if (endMon) {
      return { year: endYear, month: endMon, minYear: Math.min(startYear, endYear), maxYear: endYear };
    }
  }
  const y = headText.match(/\b(20\d{2})\b/);
  const year = y ? +y[1] : fallbackYear;
  return { year, month: 12, minYear: year - 1, maxYear: year };
}

function clampYear(year: number, base: Base): number {
  return Math.max(base.minYear, Math.min(base.maxYear, year));
}

interface AmtMatch {
  value: number;
  sign: "" | "+" | "-";
  drcr: "" | "cr" | "dr";
}

/**
 * Find money figures. Either currency-prefixed (Rs./₹/$…) where the number may
 * be a plain integer, OR a bare number that is comma-grouped or has 2 decimals
 * (so phone/reference numbers are never mistaken for amounts).
 */
function scanAmounts(text: string): AmtMatch[] {
  const re =
    /([+-])?\s*(?:rs\.?|inr|₹|\$|£|€)\s*([\d,]+(?:\.\d{1,2})?)\s*(cr|dr)?|([+-])?\s*((?:\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?)|(?:\d+\.\d{2}))\s*(cr|dr)?/gi;
  const out: AmtMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const numStr = m[2] || m[5];
    if (!numStr) continue;
    const value = parseFloat(numStr.replace(/,/g, ""));
    if (isNaN(value)) continue;
    out.push({
      value,
      sign: (m[1] || m[4] || "") as "" | "+" | "-",
      drcr: ((m[3] || m[6] || "").toLowerCase()) as "" | "cr" | "dr",
    });
  }
  return out;
}

/** The transaction amount is the (last) signed/Dr-Cr figure, else the last figure. */
function pickAmount(amts: AmtMatch[]): { value: number; direction: "in" | "out" | null } | null {
  if (!amts.length) return null;
  const directional = amts.filter((a) => a.sign || a.drcr);
  const chosen = directional.length ? directional[directional.length - 1] : amts[amts.length - 1];
  let direction: "in" | "out" | null = null;
  if (chosen.sign === "+" || chosen.drcr === "cr") direction = "in";
  else if (chosen.sign === "-" || chosen.drcr === "dr") direction = "out";
  return { value: chosen.value, direction };
}

const SELF_RE = /transferred to self|self[\s-]?transfer|#\s*self/i;
const INFLOW_KW = /received from|cashback|refund|reversal|\bcredit\b|deposit|\binward\b|money added/i;
const OUTFLOW_KW = /paid to|money sent|sent to|payment to|recharge|purchase of|\bdebit\b|withdrawal|emi for|automatic payment|paid/i;

const DESC_RE =
  /(money added to|money sent to|paid to|received from|recharge for|recharge of|purchase of|refund (?:from|for)|cashback received from|emi for|automatic payment of [^]*? for|automatic payment for|gold coin redemption|paytm merchant|transferred to self)\s*([^]*?)(?=\s*(?:upi id|upi ref|bank ref|order id|note\s*:|tag\s*:|#|union bank|idbi bank|kotak|axis bank|hdfc|icici|\bsbi\b|gold coins|loyalty|upi lite|upi linked|$))/i;

const SKIP_LINE_RE =
  /^(upi id|upi ref|bank ref|order id|note\b|note:|tag\b|tag:|#|powered by|page \d|for any queries|contact us|passbook|all payments done|date &|date\b|transaction details|notes &|your account|amount\b|paytm statement|total money|\d+ payments|self transfer)/i;

const ACCOUNT_ONLY_RE =
  /^(union bank of india|union bank|idbi bank|kotak|axis bank|hdfc|icici|gold coins|loyalty_point|upi lite|upi linked bank|india\s*-\s*\d+)\b/i;

const AMOUNT_ONLY_RE = /^[-+]?\s*(?:rs\.?|₹|inr)?\s*[\d,]+(?:\.\d{1,2})?\s*(?:cr|dr)?$/i;
const TIME_RE = /^\d{1,2}:\d{2}\s*(?:am|pm)?\b/i;

/** Remove money figures and Dr/Cr/balance noise from a fragment. */
function stripAmounts(s: string): string {
  return s
    .replace(/[+-]?\s*(?:rs\.?|inr|₹|\$|£|€)\s*[\d,]+(?:\.\d{1,2})?\s*(?:cr|dr)?/gi, " ")
    .replace(/[+-]?\s*(?:\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{2})\s*(?:cr|dr)?/gi, " ")
    .replace(/\b(?:dr|cr|debit|credit|balance|bal)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Get a human description from a transaction block. */
function extractDescription(blockText: string, candidateLines: string[]): string | null {
  const d = blockText.match(DESC_RE);
  if (d) {
    const verb = d[1].toLowerCase();
    const target = (d[2] ?? "").trim();
    // "Automatic payment of ₹15000 setup for Google Cloud" → just "Google Cloud".
    const desc = stripAmounts(/automatic payment/.test(verb) ? target || d[1] : `${d[1]} ${target}`);
    if (desc.length >= 3) return desc;
  }
  for (const raw of candidateLines) {
    const line = raw.trim();
    if (line.length < 3) continue;
    if (SKIP_LINE_RE.test(line)) continue;
    if (ACCOUNT_ONLY_RE.test(line)) continue;
    if (AMOUNT_ONLY_RE.test(line)) continue;
    if (TIME_RE.test(line)) continue;
    if (!/[A-Za-z]{3,}/.test(line)) continue;
    const cleaned = stripAmounts(line);
    if (cleaned.length >= 3) return cleaned;
  }
  return null;
}

interface Block {
  marker: Marker;
  lines: string[];
}

/**
 * Parse statement text lines into outgoing transactions.
 * Primary: block mode (split on date markers — handles multi-line rows and
 * year-less "DD Mon" dates). Fallback: per-line mode for single-line layouts.
 */
export function parseStatementLines(lines: string[], opts: ParseOptions = {}): PdfParseOutput {
  const dayFirst = opts.dayFirst ?? true;
  const refYear = opts.referenceYear ?? new Date().getFullYear();
  const currency = detectCurrencyFromText(lines.join("\n"));

  // Build blocks delimited by date markers.
  const blocks: Block[] = [];
  let firstMarkerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const marker = parseDateMarker(lines[i], dayFirst);
    if (marker) {
      if (firstMarkerIdx === -1) firstMarkerIdx = i;
      blocks.push({ marker, lines: [lines[i]] });
    } else if (blocks.length > 0) {
      blocks[blocks.length - 1].lines.push(lines[i]);
    }
  }

  const headText = lines.slice(0, firstMarkerIdx === -1 ? 60 : firstMarkerIdx + 1).join(" ");
  const base = detectBase(headText, refYear);

  const txns: RawTxn[] =
    blocks.length >= 3
      ? parseBlocks(blocks, base)
      : parsePerLine(lines, base, dayFirst);

  return finalize(txns, lines, currency);
}

function parseBlocks(blocks: Block[], base: Base): RawTxn[] {
  const txns: RawTxn[] = [];
  let currentYear = base.year;
  let prevMonth = base.month;
  let started = false;

  for (const block of blocks) {
    const { marker } = block;
    // Assign a year (statements run newest → oldest; month rising = crossed New Year going back).
    if (marker.year !== null) {
      currentYear = marker.year;
    } else if (started && marker.month > prevMonth) {
      currentYear -= 1;
    }
    prevMonth = marker.month;
    started = true;
    const year = clampYear(currentYear, base);

    const text = block.lines.join(" ");
    if (SELF_RE.test(text)) continue;

    const picked = pickAmount(scanAmounts(text));
    if (!picked || picked.value === 0) continue;

    let dir = picked.direction;
    if (!dir) {
      if (INFLOW_KW.test(text)) dir = "in";
      else if (OUTFLOW_KW.test(text)) dir = "out";
    }
    if (dir !== "out") continue;

    // Candidate description lines: the marker line minus its date, then the rest.
    const first = block.lines[0].slice(marker.len).trim();
    const candidates = first ? [first, ...block.lines.slice(1)] : block.lines.slice(1);
    const desc = extractDescription(text, candidates);
    if (!desc) continue;

    txns.push({
      date: new Date(year, marker.month - 1, marker.day),
      description: desc,
      amount: Math.abs(picked.value),
    });
  }
  return txns;
}

/** Fallback for single-line layouts: each line with a date + amount is a transaction. */
function parsePerLine(lines: string[], base: Base, dayFirst: boolean): RawTxn[] {
  const txns: RawTxn[] = [];
  let lastDate: Date | null = null;
  let currentYear = base.year;
  let prevMonth = base.month;

  for (const line of lines) {
    if (SELF_RE.test(line)) continue;
    const marker = parseDateMarker(line, dayFirst);
    if (marker) {
      if (marker.year !== null) currentYear = marker.year;
      else if (marker.month > prevMonth) currentYear -= 1;
      prevMonth = marker.month;
      lastDate = new Date(clampYear(marker.year ?? currentYear, base), marker.month - 1, marker.day);
    }
    const picked = pickAmount(scanAmounts(line));
    if (!picked || picked.value === 0 || !lastDate) continue;

    let dir = picked.direction;
    if (!dir) {
      if (INFLOW_KW.test(line)) dir = "in";
      else if (OUTFLOW_KW.test(line)) dir = "out";
    }
    if (dir !== "out") continue;

    const rest = marker ? line.slice(marker.len) : line;
    const desc = extractDescription(line, [rest]);
    if (!desc) continue;
    txns.push({ date: lastDate, description: desc, amount: Math.abs(picked.value) });
  }
  return txns;
}

function finalize(txns: RawTxn[], lines: string[], currency: string | null): PdfParseOutput {
  const totalChars = lines.reduce((s, l) => s + l.length, 0);
  const notes: string[] = [];
  if (txns.length === 0) {
    notes.push(
      totalChars < 200
        ? "This looks like a scanned or image-only PDF with no selectable text. Try a CSV export, or a PDF whose text you can highlight."
        : "We read the text but couldn't recognize the transaction rows in this layout. A CSV export will be far more accurate — please report the bank/format so we can support it."
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
  incorrect: boolean;
  constructor(message: string, incorrect = false) {
    super(message);
    this.name = "PdfPasswordError";
    this.incorrect = incorrect;
  }
}

interface PdfTextItem {
  str: string;
  transform: number[];
}

/** Reconstruct visual rows from positioned PDF text items (top→bottom, left→right). */
function itemsToLines(items: PdfTextItem[]): string[] {
  const buckets = new Map<number, { x: number; str: string }[]>();
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = Math.round(it.transform[5]);
    let key = y;
    for (const k of buckets.keys()) {
      if (Math.abs(k - y) <= 3) { key = k; break; }
    }
    const arr = buckets.get(key) ?? [];
    arr.push({ x: it.transform[4], str: it.str });
    buckets.set(key, arr);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, parts]) =>
      parts.sort((a, b) => a.x - b.x).map((p) => p.str).join(" ").replace(/\s+/g, " ").trim()
    )
    .filter(Boolean);
}

/** Extract transactions from a PDF entirely in the browser via pdf.js. */
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

  const allLines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: PdfTextItem[] = [];
    for (const i of content.items) {
      if ("str" in i) items.push({ str: i.str, transform: i.transform });
    }
    allLines.push(...itemsToLines(items));
  }
  await task.destroy();

  const result = parseStatementLines(allLines, opts);
  if (result.txns.length === 0 && allLines.length > 0 && process.env.NODE_ENV !== "production") {
    console.warn("[pdf] No transactions parsed. First lines extracted:\n" + allLines.slice(0, 50).join("\n"));
  }
  return result;
}
