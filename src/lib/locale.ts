/**
 * Location/locale helpers. The app picks a currency from (1) symbols found in
 * the statement itself, falling back to (2) the visitor's region. Dates are
 * read day-first everywhere except the handful of month-first regions.
 */

const REGION_CURRENCY: Record<string, string> = {
  US: "USD", IN: "INR", GB: "GBP", AU: "AUD", CA: "CAD", NZ: "NZD",
  SG: "SGD", JP: "JPY", CN: "CNY", HK: "HKD", CH: "CHF", SE: "SEK",
  NO: "NOK", DK: "DKK", ZA: "ZAR", AE: "AED", SA: "SAR", BR: "BRL",
  MX: "MXN", RU: "RUB", KR: "KRW", TR: "TRY", ID: "IDR", MY: "MYR",
  TH: "THB", PH: "PHP", VN: "VND", NG: "NGN", PK: "PKR", BD: "BDT",
  LK: "LKR", EG: "EGP", IL: "ILS", PL: "PLN", CZ: "CZK", HU: "HUF",
  // Eurozone
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", IE: "EUR",
  PT: "EUR", AT: "EUR", BE: "EUR", FI: "EUR", GR: "EUR", SK: "EUR",
  SI: "EUR", LT: "EUR", LV: "EUR", EE: "EUR", LU: "EUR", MT: "EUR", CY: "EUR",
};

/** Regions that write dates month-first (MM/DD/YYYY). Everywhere else is day-first. */
const MONTH_FIRST = new Set(["US", "PH", "FM", "MH", "PW"]);

/** Best-guess ISO region from the browser locale, e.g. "en-IN" → "IN". */
export function detectRegion(): string {
  if (typeof navigator === "undefined") return "US";
  const lang = navigator.language || (navigator.languages && navigator.languages[0]) || "en-US";
  const parts = lang.split("-");
  const region = parts[parts.length - 1];
  if (region && region.length === 2) return region.toUpperCase();
  return "US";
}

export function regionCurrency(region: string): string {
  return REGION_CURRENCY[region.toUpperCase()] ?? "USD";
}

export function isDayFirstRegion(region: string): boolean {
  return !MONTH_FIRST.has(region.toUpperCase());
}

/** Symbol / code → currency. Order matters: check distinctive ones first. */
const TEXT_CURRENCY: [RegExp, string][] = [
  [/₹|\brs\.?\b|\binr\b|rupee/i, "INR"],
  [/£|\bgbp\b/i, "GBP"],
  [/€|\beur\b/i, "EUR"],
  [/₩|\bkrw\b/i, "KRW"],
  [/₽|\brub\b/i, "RUB"],
  [/R\$|\bbrl\b/i, "BRL"],
  [/₦|\bngn\b/i, "NGN"],
  [/¥|\bjpy\b|\bcny\b|\brmb\b/i, "JPY"],
  [/\baed\b|dirham/i, "AED"],
  [/A\$|\baud\b/i, "AUD"],
  [/C\$|\bcad\b/i, "CAD"],
  [/\bchf\b/i, "CHF"],
  [/\bzar\b/i, "ZAR"],
  [/\$|\busd\b/i, "USD"],
];

/** Sniff a currency out of raw statement text (returns null if unsure). */
export function detectCurrencyFromText(text: string): string | null {
  const sample = text.slice(0, 20000);
  for (const [re, code] of TEXT_CURRENCY) {
    if (re.test(sample)) return code;
  }
  return null;
}

/** Resolve the currency to display: statement first, then the visitor's region. */
export function resolveCurrency(text?: string | null): string {
  if (text) {
    const fromText = detectCurrencyFromText(text);
    if (fromText) return fromText;
  }
  return regionCurrency(detectRegion());
}
