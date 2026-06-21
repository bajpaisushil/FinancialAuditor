import type { Analysis } from "../types";
import type { Category } from "../categorize";
import { aggregateCategories } from "../overview";
import { getAiModel, setAiModel } from "./modelStatus";

/**
 * On-device, embedding-based categorization. A tiny sentence-transformer
 * (~25 MB, runs in WASM) embeds each merchant name and matches it to the
 * nearest category prototype. It only RE-labels merchants the keyword
 * classifier left as "other", so confident brand matches never regress.
 *
 * Everything runs in the browser — the model is public weights, your
 * statement never leaves the device. Cached after first download (offline).
 */

const MODEL = "Xenova/all-MiniLM-L6-v2";
const THRESHOLD = 0.3; // min cosine similarity to trust an AI label

/** Short anchor phrases per category, India-aware. Averaged into a prototype vector. */
const ANCHORS: Partial<Record<Category, string[]>> = {
  coffee: ["Starbucks coffee", "cafe latte", "ice cream parlour", "bakery cake shop", "chai tea stall", "donut and snacks"],
  dining: ["Swiggy food delivery", "Zomato food order", "restaurant dinner bill", "McDonald's burger", "Domino's pizza", "dhaba meal", "biryani lunch", "Daalchini snack vending"],
  groceries: ["BigBasket groceries", "Blinkit grocery", "Zepto grocery delivery", "DMart supermarket", "kirana general store", "vegetables and fruits sabzi", "Reliance Fresh"],
  shopping: ["Amazon online shopping", "Flipkart order", "Myntra clothing", "shopping mall purchase", "electronics store", "Meesho", "Nykaa cosmetics", "apparel and footwear"],
  transport: ["Uber ride", "Ola cab", "petrol diesel fuel pump", "Delhi metro travel", "auto rickshaw", "Rapido bike taxi", "parking fee", "FASTag toll"],
  travel: ["IRCTC train ticket", "IndiGo flight booking", "hotel room booking", "MakeMyTrip", "OYO rooms", "redBus bus ticket", "airline travel"],
  entertainment: ["Netflix subscription", "Spotify music", "BookMyShow movie", "Disney Hotstar", "YouTube premium", "PVR cinema", "online gaming"],
  software: ["Google Cloud", "AWS India web services", "ChatGPT subscription", "GitHub", "Adobe Creative Cloud", "Microsoft 365", "domain and hosting", "VPN subscription"],
  bills: ["electricity bill BSES", "Jio mobile recharge", "Airtel postpaid bill", "broadband internet bill", "water bill", "LPG gas cylinder", "DTH recharge", "LIC insurance premium"],
  health: ["pharmacy medicines", "Apollo hospital", "doctor clinic visit", "diagnostic lab blood test", "gym membership", "dentist", "1mg medicine order"],
  investments: ["mutual fund SIP investment", "Zerodha stocks trading", "Groww investment", "Atal Pension APY", "fixed deposit", "PPF NPS", "broking securities"],
  people: [
    "money sent to Ramesh Kumar", "paid to a friend named Vijay", "transfer to family member",
    "UPI payment to a person", "personal money transfer to an individual",
    "rent paid to landlord", "sent money to Sudha", "paid Mahesh", "gave money to Priya",
  ],
  cash: ["ATM cash withdrawal", "cash withdrawn", "wire transfer", "money to own account"],
};

type Extractor = (texts: string[], opts: { pooling: "mean"; normalize: boolean }) => Promise<{ tolist(): number[][] }>;

let extractorPromise: Promise<Extractor> | null = null;
let prototypes: { cat: Category; vec: number[] }[] | null = null;

export type ProgressFn = (e: { status: string; progress?: number }) => void;

async function getExtractor(onProgress?: ProgressFn): Promise<Extractor> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      const pipe = await pipeline("feature-extraction", MODEL, {
        progress_callback: (e: { status?: string; progress?: number }) => {
          if (onProgress) onProgress({ status: e.status ?? "loading", progress: e.progress });
        },
      });
      return pipe as unknown as Extractor;
    })().catch((err) => {
      // Don't cache a rejected promise — otherwise every later attempt (e.g.
      // hitting "Retry" once back online) just re-returns this same failure and
      // never re-downloads. Clear it so the next call starts fresh.
      extractorPromise = null;
      throw err;
    });
  }
  return extractorPromise;
}

/**
 * Download + cache the model (and build category prototypes) without needing an
 * analysis yet. Lets the user start the ~25 MB download early — while they're
 * still online — so categorization works later even offline. Idempotent and
 * safe to call repeatedly; drives the shared status store for the UI.
 */
export async function warmupModel(onProgress?: ProgressFn): Promise<void> {
  if (getAiModel().status === "ready") return;
  try {
    setAiModel({ status: "downloading", progress: 0 });
    const extractor = await getExtractor((e) => {
      const p = typeof e.progress === "number" ? Math.round(e.progress) : getAiModel().progress;
      setAiModel({ status: "downloading", progress: p });
      onProgress?.(e);
    });
    await getPrototypes(extractor);
    setAiModel({ status: "ready", progress: 100 });
  } catch (err) {
    setAiModel({ status: "error", progress: 0 });
    throw err;
  }
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

const COMPANY_WORDS =
  /\b(bank|ltd|limited|pvt|private|enterprise|enterprises|store|mart|services|solutions|technologies|systems|hospital|clinic|pharmacy|metro|cloud|fund|broking|securities|payments|india|foundation|trust|temple|mandir|iskcon|corp|company|industries|traders|agency|center|centre|shop|hotel|restaurant|cafe|kirana|medical|finance|financial|insurance|telecom|mobile|infotech|software|labs|capital|ventures|university|college|school)\b/i;

/** Deterministic: a 2–4 word, all-alphabetic, non-company name is almost always a person. */
function looksLikePerson(name: string): boolean {
  const tokens = name.trim().split(/\s+/);
  if (tokens.length < 2 || tokens.length > 4) return false;
  if (COMPANY_WORDS.test(name)) return false;
  return tokens.every((t) => /^[A-Za-z][A-Za-z.]*$/.test(t) && t.length >= 2);
}

/** A lone alphabetic token (e.g. "Sushil", "Mousumi") — likely a first name. */
function isLikelyNameToken(name: string): boolean {
  const t = name.trim();
  return /^[A-Za-z]{3,15}$/.test(t) && !COMPANY_WORDS.test(t);
}

async function getPrototypes(extractor: Extractor): Promise<{ cat: Category; vec: number[] }[]> {
  if (prototypes) return prototypes;
  const cats: Category[] = [];
  const texts: string[] = [];
  const owner: Category[] = [];
  for (const cat of Object.keys(ANCHORS) as Category[]) {
    cats.push(cat);
    for (const a of ANCHORS[cat]!) {
      texts.push(a);
      owner.push(cat);
    }
  }
  const vecs = (await extractor(texts, { pooling: "mean", normalize: true })).tolist();
  const sums = new Map<Category, number[]>();
  const counts = new Map<Category, number>();
  vecs.forEach((v, i) => {
    const c = owner[i];
    const acc = sums.get(c) ?? new Array(v.length).fill(0);
    for (let k = 0; k < v.length; k++) acc[k] += v[k];
    sums.set(c, acc);
    counts.set(c, (counts.get(c) ?? 0) + 1);
  });
  prototypes = cats.map((c) => {
    const acc = sums.get(c)!;
    const n = counts.get(c)!;
    const avg = acc.map((x) => x / n);
    const norm = Math.sqrt(dot(avg, avg)) || 1;
    return { cat: c, vec: avg.map((x) => x / norm) };
  });
  return prototypes;
}

/** Best category + cosine score for each name. */
async function classifyNames(names: string[], extractor: Extractor): Promise<{ cat: Category; score: number }[]> {
  const protos = await getPrototypes(extractor);
  const vecs = (await extractor(names, { pooling: "mean", normalize: true })).tolist();
  return vecs.map((v) => {
    let best = protos[0];
    let bs = -1;
    for (const p of protos) {
      const d = dot(v, p.vec);
      if (d > bs) {
        bs = d;
        best = p;
      }
    }
    return { cat: best.cat, score: bs };
  });
}

/**
 * Re-categorize the long tail with the on-device model and return an updated
 * Analysis. Only merchants the keyword classifier left as "other" are changed.
 */
export async function enhanceAnalysis(analysis: Analysis, onProgress?: ProgressFn): Promise<Analysis> {
  // Ensure the model is downloaded (no-op if already cached) and keep the shared
  // status store in sync whether we got here from the landing card or the toggle.
  await warmupModel(onProgress);
  const extractor = await getExtractor();
  const { merchants } = analysis.overview;
  onProgress?.({ status: "categorizing" });

  const names = merchants.map((m) => m.name);
  const results = await classifyNames(names, extractor);

  const newMerchants = merchants.map((m, i) => {
    if (m.category !== "other") return m; // trust confident keyword/brand matches
    // Multi-word human names are people, deterministically.
    if (looksLikePerson(m.name)) return { ...m, category: "people" as Category };
    const r = results[i];
    // A strong embedding match wins even for a single token (e.g. "Pizzahut").
    if (r.score >= 0.4) return { ...m, category: r.cat };
    // Otherwise a lone name-like token is almost always a person/transfer.
    if (isLikelyNameToken(m.name)) return { ...m, category: "people" as Category };
    if (r.score >= THRESHOLD) return { ...m, category: r.cat };
    return m;
  });

  const categories = aggregateCategories(newMerchants, analysis.overview.totalSpent);
  return {
    ...analysis,
    overview: {
      ...analysis.overview,
      merchants: newMerchants,
      categories,
      biggestCategory: categories[0] ?? null,
    },
  };
}
