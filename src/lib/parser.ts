import type { RawTxn } from "./types";

/** Split a single CSV line, honoring quoted fields and escaped quotes. */
function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function detectDelimiter(sample: string): string {
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates) {
    // Count occurrences outside of obvious quotes (rough heuristic).
    const count = (sample.match(new RegExp(`\\${d === "\t" ? "t" : d}`, "g")) || [])
      .length;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

const DATE_HEADERS = ["date", "posted", "transaction date", "trans date", "time"];
const DESC_HEADERS = [
  "description",
  "desc",
  "name",
  "merchant",
  "payee",
  "details",
  "memo",
  "transaction",
  "narration",
  "particulars",
];
const AMOUNT_HEADERS = ["amount", "amt", "value", "transaction amount"];
const DEBIT_HEADERS = ["debit", "withdrawal", "withdrawals", "money out", "paid out", "outflow"];
const CREDIT_HEADERS = ["credit", "deposit", "money in", "paid in", "inflow"];

function findColumn(headers: string[], names: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  // Exact match first, then "includes".
  for (const n of names) {
    const idx = lower.indexOf(n);
    if (idx !== -1) return idx;
  }
  for (let i = 0; i < lower.length; i++) {
    if (names.some((n) => lower[i].includes(n))) return i;
  }
  return -1;
}

/** Parse a money string like "$1,234.56", "(45.00)", "-12.30 USD". */
export function parseAmount(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || s.includes("-") || /\bDR\b/i.test(s);
  s = s.replace(/[()]/g, "");
  // Strip currency symbols, codes, and spaces; keep digits, separators, sign.
  s = s.replace(/[^0-9.,-]/g, "");
  // Handle European "1.234,56" vs US "1,234.56".
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    // Comma as decimal if it looks like one (exactly 2 trailing digits).
    if (/,\d{2}$/.test(s) && !/,\d{3}$/.test(s)) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
  }
  s = s.replace(/-/g, "");
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return negative ? -n : n;
}

/** Parse many common date formats into a Date (or null). */
export function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  // ISO-ish: 2024-03-15 or 2024/03/15
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isValid(d) ? d : null;
  }

  // D/M/Y or M/D/Y
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let a = +m[1];
    let b = +m[2];
    let year = +m[3];
    if (year < 100) year += year < 70 ? 2000 : 1900;
    // If first part > 12 it must be a day -> D/M/Y. Otherwise assume M/D/Y (US).
    let month: number, day: number;
    if (a > 12) {
      day = a;
      month = b;
    } else {
      month = a;
      day = b;
    }
    const d = new Date(year, month - 1, day);
    return isValid(d) ? d : null;
  }

  // "15 Mar 2024", "Mar 15, 2024", "15-Mar-2024"
  const parsed = new Date(s);
  if (isValid(parsed)) return parsed;
  return null;
}

function isValid(d: Date): boolean {
  return d instanceof Date && !isNaN(d.getTime()) && d.getFullYear() > 1990 && d.getFullYear() < 2100;
}

export interface ParseOutput {
  txns: RawTxn[];
  notes: string[];
}

/**
 * Parse raw CSV text into normalized transactions.
 * All amounts are returned as POSITIVE = money spent (outflow).
 */
export function parseCsv(text: string): ParseOutput {
  const notes: string[] = [];
  // Normalize newlines, drop a UTF-8 BOM, drop fully empty lines.
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r\n|\r|\n/)
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { txns: [], notes: ["File looks empty or has no data rows."] };
  }

  const delimiter = detectDelimiter(lines.slice(0, 5).join("\n"));
  const headers = splitCsvLine(lines[0], delimiter);

  const dateIdx = findColumn(headers, DATE_HEADERS);
  const descIdx = findColumn(headers, DESC_HEADERS);
  const amountIdx = findColumn(headers, AMOUNT_HEADERS);
  const debitIdx = findColumn(headers, DEBIT_HEADERS);
  const creditIdx = findColumn(headers, CREDIT_HEADERS);

  const haveHeader = dateIdx !== -1 || descIdx !== -1 || amountIdx !== -1 || debitIdx !== -1;
  if (!haveHeader) {
    notes.push(
      "Couldn't recognize the column headers. We tried our best to guess Date / Description / Amount."
    );
  }

  // Fallback positional guesses for headerless or odd files.
  const dIdx = dateIdx !== -1 ? dateIdx : 0;
  const nIdx = descIdx !== -1 ? descIdx : guessDescIdx(lines, delimiter);
  const aIdx = amountIdx !== -1 ? amountIdx : -1;

  const txns: RawTxn[] = [];
  let skipped = 0;
  const startRow = haveHeader ? 1 : 0;

  for (let r = startRow; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r], delimiter);
    if (cells.length < 2) continue;

    const date = parseDate(cells[dIdx] ?? "");
    const description = (cells[nIdx] ?? "").trim();

    let amount: number | null = null;
    if (aIdx !== -1) {
      amount = parseAmount(cells[aIdx] ?? "");
    }
    if (amount === null && debitIdx !== -1) {
      const debit = parseAmount(cells[debitIdx] ?? "");
      const credit = creditIdx !== -1 ? parseAmount(cells[creditIdx] ?? "") : null;
      if (debit && debit !== 0) amount = -Math.abs(debit);
      else if (credit && credit !== 0) amount = Math.abs(credit);
    }
    if (amount === null && aIdx === -1) {
      // Last resort: find the most number-like trailing cell.
      for (let c = cells.length - 1; c >= 0; c--) {
        const v = parseAmount(cells[c]);
        if (v !== null && c !== dIdx) {
          amount = v;
          break;
        }
      }
    }

    if (!date || !description || amount === null || amount === 0) {
      skipped++;
      continue;
    }

    // Outflows only (money spent). Statement debits are negative -> flip to positive.
    if (amount < 0) {
      txns.push({ date, description, amount: Math.abs(amount) });
    }
  }

  if (txns.length === 0 && skipped > 0) {
    notes.push(
      "We parsed the file but found no outgoing charges. If your bank lists spending as positive numbers, we may have read them as income."
    );
  }
  if (skipped > 0 && txns.length > 0) {
    notes.push(`${skipped} row${skipped === 1 ? "" : "s"} couldn't be read and were skipped.`);
  }

  return { txns, notes };
}

/** Pick the column with the longest average text — likely the description. */
function guessDescIdx(lines: string[], delimiter: string): number {
  const sample = lines.slice(1, 20).map((l) => splitCsvLine(l, delimiter));
  if (sample.length === 0) return 1;
  const cols = Math.max(...sample.map((r) => r.length));
  let bestIdx = 1;
  let bestLen = -1;
  for (let c = 0; c < cols; c++) {
    let total = 0;
    let textish = 0;
    for (const row of sample) {
      const cell = row[c] ?? "";
      total += cell.length;
      if (/[a-zA-Z]{3,}/.test(cell)) textish++;
    }
    const avg = total / sample.length;
    if (textish > sample.length / 2 && avg > bestLen) {
      bestLen = avg;
      bestIdx = c;
    }
  }
  return bestIdx;
}
