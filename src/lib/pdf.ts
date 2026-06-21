import type { RawTxn } from "./types";
import { type ParseOptions } from "./parser";
import { detectCurrencyFromText } from "./locale";

export interface PdfParseOutput {
  txns: RawTxn[];
  notes: string[];
  currency: string | null;
  /** A few extracted text lines, surfaced when parsing fails so the layout can be reported. */
  sampleLines?: string[];
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
  len: number;
}

/** A statement-period header like "21 JUN'25 - 20 JUN'26" — never a transaction. */
const DATE_RANGE_RE =
  /\d{1,2}\s*[A-Za-z]{3,9}'?\s*\d{2,4}\s*(?:-|–|—|to)\s*\d{1,2}\s*[A-Za-z]{3,9}/i;

/** A line is a date marker when it STARTS with a recognizable date. */
function parseDateMarker(line: string, dayFirst: boolean): Marker | null {
  if (DATE_RANGE_RE.test(line)) return null;
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
  m = line.match(/^\s*(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) return { year: +m[1], month: +m[2], day: +m[3], len: m[0].length };
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

function detectBase(headText: string, fallbackYear: number): Base {
  const m = headText.match(
    /(\d{1,2})[\s-]*([A-Za-z]{3,9})'?[\s-]*(\d{2,4})\s*(?:-|–|—|to)\s*(\d{1,2})[\s-]*([A-Za-z]{3,9})'?[\s-]*(\d{2,4})/i
  );
  if (m) {
    const endMon = MONTHS[m[5].toLowerCase()];
    let startYear = +m[3];
    if (startYear < 100) startYear += startYear < 70 ? 2000 : 1900;
    let endYear = +m[6];
    if (endYear < 100) endYear += endYear < 70 ? 2000 : 1900;
    if (endMon) return { year: endYear, month: endMon, minYear: Math.min(startYear, endYear), maxYear: endYear };
  }
  const y = headText.match(/\b(20\d{2})\b/);
  const year = y ? +y[1] : fallbackYear;
  return { year, month: 12, minYear: year - 1, maxYear: year };
}

function clampYear(year: number, base: Base): number {
  return Math.max(base.minYear, Math.min(base.maxYear, year));
}

/** Walk markers in document order (newest→oldest) and infer the year for year-less dates. */
function makeYearWalker(base: Base): (m: Marker) => number {
  let currentYear = base.year;
  let prevMonth = base.month;
  let started = false;
  return (marker: Marker) => {
    if (marker.year !== null) {
      // An explicit year on the row is authoritative — never clamp it.
      currentYear = marker.year;
      prevMonth = marker.month;
      started = true;
      return marker.year;
    }
    if (started && marker.month > prevMonth) currentYear -= 1;
    prevMonth = marker.month;
    started = true;
    return clampYear(currentYear, base);
  };
}

interface AmtMatch {
  value: number;
  sign: "" | "+" | "-";
  drcr: "" | "cr" | "dr";
}

function scanAmounts(text: string): AmtMatch[] {
  const re =
    /([+-])?\s*(?:rs\.?|inr|₹|\$|£|€)\s*([\d,]+(?:\.\d{1,2})?)\s*(cr|dr)?|([+-])?\s*((?:\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?)|(?:\d+\.\d{2}))\s*(cr|dr)?/gi;
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

const MONEY_CELL_RE = /^[-+]?\s*(?:rs\.?|₹|inr|\$|£|€)?\s*[\d,]+(?:\.\d{1,2})?\s*(?:cr|dr)?$/i;
function parseAmountCell(str: string): number | null {
  const s = str.trim();
  if (!MONEY_CELL_RE.test(s)) return null;
  // Require a decimal, a comma, or a currency symbol — never a bare integer (ref/phone numbers).
  if (!/[.,]/.test(s) && !/(?:rs|₹|inr|\$|£|€)/i.test(s)) return null;
  const neg = /^-/.test(s) || /dr$/i.test(s);
  const n = parseFloat(s.replace(/[^\d.]/g, ""));
  if (isNaN(n)) return null;
  return neg ? -n : n;
}

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
const INFLOW_KW = /received from|cashback|refund|reversal|\bcredit\b|deposit|\binward\b|money added|\bcr\b|\bneft cr\b|salary|interest/i;
const OUTFLOW_KW = /paid to|money sent|sent to|payment to|recharge|purchase of|\bdebit\b|withdrawal|withdrawn|\bwdl\b|atm|emi for|automatic payment|\bpaid\b|\bdr\b|pos\b|imps\b|upi\b/i;

const DESC_RE =
  /(money added to|money sent to|paid to|received from|recharge for|recharge of|purchase of|refund (?:from|for)|cashback received from|emi for|automatic payment of [^]*? for|automatic payment for|gold coin redemption|paytm merchant|transferred to self)\s*([^]*?)(?=\s*(?:upi id|upi ref|bank ref|order id|note\s*:|tag\s*:|#|union bank|idbi bank|kotak|axis bank|hdfc|icici|\bsbi\b|gold coins|loyalty|upi lite|upi linked|$))/i;

const SKIP_LINE_RE =
  /^(upi id|upi ref|bank ref|order id|note\b|note:|tag\b|tag:|#|powered by|page \d|for any queries|contact us|passbook|all payments done|date &|date\b|transaction details|notes &|your account|amount\b|paytm statement|total money|\d+ payments|self transfer|opening balance|closing balance|brought forward|statement|particulars|narration|description)/i;

const ACCOUNT_ONLY_RE =
  /^(union bank of india|union bank|idbi bank|kotak|axis bank|hdfc|icici|gold coins|loyalty_point|upi lite|upi linked bank|india\s*-\s*\d+)\b/i;

const AMOUNT_ONLY_RE = /^[-+]?\s*(?:rs\.?|₹|inr|\$)?\s*[\d,]+(?:\.\d{1,2})?\s*(?:cr|dr)?$/i;
const TIME_RE = /^\d{1,2}:\d{2}\s*(?:am|pm)?\b/i;

function stripAmounts(s: string): string {
  return s
    .replace(/[+-]?\s*(?:rs\.?|inr|₹|\$|£|€)\s*[\d,]+(?:\.\d{1,2})?\s*(?:cr|dr)?/gi, " ")
    .replace(/[+-]?\s*(?:\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+\.\d{2})\s*(?:cr|dr)?/gi, " ")
    .replace(/\b(?:dr|cr|debit|credit|balance|bal)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDescription(blockText: string, candidateLines: string[]): string | null {
  const d = blockText.match(DESC_RE);
  if (d) {
    const verb = d[1].toLowerCase();
    const target = (d[2] ?? "").trim();
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

// ─────────────────────────── Line / block parser (Paytm-style) ───────────────────────────

interface Block {
  marker: Marker;
  lines: string[];
}

function txnsFromLines(lines: string[], opts: ParseOptions): RawTxn[] {
  const dayFirst = opts.dayFirst ?? true;
  const refYear = opts.referenceYear ?? new Date().getFullYear();

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

  return blocks.length >= 3 ? parseBlocks(blocks, base) : parsePerLine(lines, base, dayFirst);
}

function parseBlocks(blocks: Block[], base: Base): RawTxn[] {
  const txns: RawTxn[] = [];
  const nextYear = makeYearWalker(base);

  for (const block of blocks) {
    const { marker } = block;
    const year = nextYear(marker);

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

    const first = block.lines[0].slice(marker.len).trim();
    const candidates = first ? [first, ...block.lines.slice(1)] : block.lines.slice(1);
    const desc = extractDescription(text, candidates);
    if (!desc) continue;

    txns.push({ date: new Date(year, marker.month - 1, marker.day), description: desc, amount: Math.abs(picked.value) });
  }
  return txns;
}

function parsePerLine(lines: string[], base: Base, dayFirst: boolean): RawTxn[] {
  const txns: RawTxn[] = [];
  let lastDate: Date | null = null;
  const nextYear = makeYearWalker(base);

  for (const line of lines) {
    if (SELF_RE.test(line)) continue;
    const marker = parseDateMarker(line, dayFirst);
    if (marker) lastDate = new Date(nextYear(marker), marker.month - 1, marker.day);

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

// ─────────────────────── Column-aware parser (tabular bank statements) ───────────────────────

interface Cell {
  x: number;
  str: string;
}
interface Row {
  y: number;
  cells: Cell[];
}

function rowToText(row: Row): string {
  return row.cells.map((c) => c.str).join(" ").replace(/\s+/g, " ").trim();
}

type ColKey = "date" | "desc" | "debit" | "credit" | "amount" | "balance";
type Columns = Partial<Record<ColKey, number>>;

const HEADER_DEFS: [ColKey, Set<string>][] = [
  ["date", new Set(["date", "txndate", "transactiondate", "valuedate", "postingdate", "trandate", "datetime", "valuedt", "txn"])],
  ["desc", new Set(["description", "narration", "particulars", "details", "remarks", "payee", "transactiondetails", "naration", "transaction", "transactionremarks", "transactionparticulars"])],
  ["debit", new Set(["debit", "withdrawal", "withdrawals", "withdrawl", "dr", "paidout", "moneyout", "withdrawalamt", "debitamount", "withdrawaldr", "debits", "withdrawalsdr", "amountdr"])],
  ["credit", new Set(["credit", "deposit", "deposits", "cr", "paidin", "moneyin", "depositamt", "creditamount", "depositcr", "credits", "amountcr"])],
  ["amount", new Set(["amount", "amt", "transactionamount", "amountinr"])],
  ["balance", new Set(["balance", "closingbalance", "runningbalance", "bal", "balanceinr", "availablebalance", "balanceamt"])],
];

function detectColumns(cells: Cell[]): Columns | null {
  const cols: Columns = {};
  for (const cell of cells) {
    const label = cell.str.toLowerCase().replace(/[^a-z]/g, "");
    if (!label) continue;
    for (const [key, set] of HEADER_DEFS) {
      if (cols[key] === undefined && set.has(label)) {
        cols[key] = cell.x;
        break;
      }
    }
  }
  const hasDrCrPair = cols.debit !== undefined && cols.credit !== undefined;
  const hasAmtBal = cols.amount !== undefined && cols.balance !== undefined;
  const hasOneSideBal =
    (cols.debit !== undefined || cols.credit !== undefined) && cols.balance !== undefined;
  // A real bank table: a date/description column plus a recognizable money structure.
  if ((cols.date !== undefined || cols.desc !== undefined) && (hasDrCrPair || hasAmtBal || hasOneSideBal)) {
    return cols;
  }
  return null;
}

/** Find the header, allowing it to span up to 3 stacked rows (common in bank PDFs). */
function detectHeader(rows: Row[]): { cols: Columns; idx: number } | null {
  for (let i = 0; i < rows.length; i++) {
    let merged: Cell[] = [];
    for (let w = 0; w < 3 && i + w < rows.length; w++) {
      merged = merged.concat(rows[i + w].cells);
      const cols = detectColumns(merged);
      if (cols) return { cols, idx: i + w };
    }
  }
  return null;
}

/** The date cell of a row: the date-parseable cell nearest the date column. */
function findDate(row: Row, dateX: number | undefined, dayFirst: boolean): Marker | null {
  let best: Marker | null = null;
  let bd = Infinity;
  for (const cell of row.cells) {
    const m = parseDateMarker(cell.str, dayFirst);
    if (!m) continue;
    const d = dateX !== undefined ? Math.abs(cell.x - dateX) : cell.x;
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

/** Build a description from the cells sitting in the description column band. */
function columnDescription(row: Row, cols: Columns, moneyMinX: number): string | null {
  const left = cols.desc !== undefined ? cols.desc - 30 : cols.date !== undefined ? cols.date + 20 : -Infinity;
  let s = row.cells
    .filter((c) => c.x >= left && c.x < moneyMinX - 5)
    .map((c) => c.str)
    .join(" ");
  s = s.replace(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g, " ").replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, " ");
  return extractDescription(s, [s]);
}

export function txnsFromColumns(rows: Row[], opts: ParseOptions): RawTxn[] {
  const dayFirst = opts.dayFirst ?? true;
  const refYear = opts.referenceYear ?? new Date().getFullYear();

  const header = detectHeader(rows);
  if (!header) return [];
  const { cols, idx: headerIdx } = header;

  const moneyCols = (["debit", "credit", "amount", "balance"] as ColKey[])
    .filter((k) => cols[k] !== undefined)
    .map((k) => [k, cols[k]!] as [ColKey, number]);
  if (!moneyCols.length) return [];
  const moneyMinX = Math.min(...moneyCols.map(([, x]) => x));

  const headText = rows.slice(0, headerIdx + 1).map(rowToText).join(" ");
  const base = detectBase(headText, refYear);
  const nextYear = makeYearWalker(base);

  const txns: RawTxn[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    // Read the date from its column (rows may start with a serial number).
    const marker = findDate(row, cols.date, dayFirst);
    if (!marker) continue; // footer / continuation row
    const text = rowToText(row);
    if (SELF_RE.test(text)) { nextYear(marker); continue; }
    const year = nextYear(marker);

    // Assign each numeric cell to its nearest money column (separates withdrawal/deposit/balance).
    const assigned: Partial<Record<ColKey, number>> = {};
    for (const cell of row.cells) {
      const v = parseAmountCell(cell.str);
      if (v === null) continue;
      let best: ColKey | null = null;
      let bd = Infinity;
      for (const [k, x] of moneyCols) {
        const dist = Math.abs(cell.x - x);
        if (dist < bd) { bd = dist; best = k; }
      }
      if (best && bd < 160) assigned[best] = v;
    }

    let outflow: number | null = null;
    if (cols.debit !== undefined || cols.credit !== undefined) {
      if (assigned.debit && assigned.debit !== 0) outflow = Math.abs(assigned.debit);
      else continue; // a credit (deposit) or empty row
    } else if (assigned.amount && assigned.amount !== 0) {
      if (INFLOW_KW.test(text)) continue;
      if (assigned.amount < 0 || /\bdr\b/i.test(text) || OUTFLOW_KW.test(text)) outflow = Math.abs(assigned.amount);
      else continue;
    }
    if (outflow === null) continue;

    const desc = columnDescription(row, cols, moneyMinX);
    if (!desc) continue;

    txns.push({ date: new Date(year, marker.month - 1, marker.day), description: desc, amount: outflow });
  }
  return txns;
}

/** Lines that look like transaction rows or the column header — useful for diagnosing a new layout. */
function pickSampleLines(lines: string[]): string[] {
  const interesting =
    /\b(withdrawal|deposit|balance|debit|credit|narration|particulars|description|cheque|chq|value date|txn|transaction|amount)\b|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b|[\d,]+\.\d{2}|(?:rs\.?|₹|inr)\s*\d/i;
  const hits = lines.filter((l) => l.trim().length > 1 && interesting.test(l));
  const chosen = hits.length >= 5 ? hits : lines.filter((l) => l.trim().length > 1);
  return chosen.slice(0, 30);
}

function finalize(txns: RawTxn[], lines: string[], currency: string | null): PdfParseOutput {
  const totalChars = lines.reduce((s, l) => s + l.length, 0);
  const notes: string[] = [];
  let sampleLines: string[] | undefined;
  if (txns.length === 0) {
    if (totalChars < 200) {
      notes.push(
        "This looks like a scanned or image-only PDF with no selectable text. Try a CSV export, or a PDF whose text you can highlight."
      );
    } else {
      notes.push(
        "We couldn't read this statement's layout automatically. Please try a CSV/Excel export from your bank — that always works."
      );
      // Raw extraction is a developer diagnostic only — never shown to production users.
      if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
        sampleLines = pickSampleLines(lines);
      }
    }
  } else {
    notes.push(
      `Read ${txns.length} transactions from the PDF. PDF parsing is best-effort — if anything looks off, a CSV export is more precise.`
    );
  }
  return { txns, notes, currency, sampleLines };
}

/** Public: parse already-reconstructed text lines (line/block strategy). Used by tests. */
export function parseStatementLines(lines: string[], opts: ParseOptions = {}): PdfParseOutput {
  const currency = detectCurrencyFromText(lines.join("\n"));
  return finalize(txnsFromLines(lines, opts), lines, currency);
}

let workerConfigured = false;

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

/** Reconstruct visual rows (with cell x-positions) from positioned PDF text items. */
function itemsToRows(items: PdfTextItem[]): Row[] {
  const buckets = new Map<number, Cell[]>();
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
    .map(([y, cells]) => ({ y, cells: cells.sort((a, b) => a.x - b.x) }));
}

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

  const allRows: Row[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: PdfTextItem[] = [];
    for (const i of content.items) {
      if ("str" in i) items.push({ str: i.str, transform: i.transform });
    }
    allRows.push(...itemsToRows(items));
  }
  await task.destroy();

  const lines = allRows.map(rowToText).filter(Boolean);
  const currency = detectCurrencyFromText(lines.join("\n"));

  // Run both strategies; use whichever recognizes more transactions.
  const columnTxns = txnsFromColumns(allRows, opts);
  const lineTxns = txnsFromLines(lines, opts);
  const txns = columnTxns.length > lineTxns.length ? columnTxns : lineTxns;

  if (txns.length === 0 && lines.length > 0 && process.env.NODE_ENV !== "production") {
    console.warn("[pdf] No transactions parsed. First lines extracted:\n" + lines.slice(0, 50).join("\n"));
  }
  return finalize(txns, lines, currency);
}
