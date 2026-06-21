export type Category =
  | "coffee"
  | "dining"
  | "groceries"
  | "shopping"
  | "transport"
  | "travel"
  | "entertainment"
  | "software"
  | "bills"
  | "health"
  | "investments"
  | "people"
  | "cash"
  | "other";

export interface CategoryMeta {
  key: Category;
  label: string;
  /** Hex used for bars/dots. Chosen to stay distinct on the dark theme. */
  color: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  coffee: { key: "coffee", label: "Coffee & Snacks", color: "#f59e0b" },
  dining: { key: "dining", label: "Dining & Takeout", color: "#fb7185" },
  groceries: { key: "groceries", label: "Groceries", color: "#34d399" },
  shopping: { key: "shopping", label: "Shopping", color: "#a78bfa" },
  transport: { key: "transport", label: "Transport & Fuel", color: "#38bdf8" },
  travel: { key: "travel", label: "Travel", color: "#22d3ee" },
  entertainment: { key: "entertainment", label: "Entertainment", color: "#f472b6" },
  software: { key: "software", label: "Software & Apps", color: "#818cf8" },
  bills: { key: "bills", label: "Bills & Utilities", color: "#94a3b8" },
  health: { key: "health", label: "Health & Fitness", color: "#2dd4bf" },
  investments: { key: "investments", label: "Investments", color: "#4ade80" },
  people: { key: "people", label: "People & Transfers", color: "#c4b5fd" },
  cash: { key: "cash", label: "Cash & ATM", color: "#cbd5e1" },
  other: { key: "other", label: "Other", color: "#64748b" },
};

/** Ordered most-specific first; first keyword hit wins. */
const RULES: { category: Category; keywords: string[] }[] = [
  {
    category: "coffee",
    keywords: [
      "starbucks", "dunkin", "coffee", "cafe", "caffe", "peet", "blue bottle",
      "tim horton", "costa", "ice cream", "baskin", "dairy queen", "cold stone",
      "gelato", "donut", "doughnut", "bakery", "boba", "juice", "smoothie",
      "snack", "yogurt", "froyo",
    ],
  },
  {
    category: "dining",
    keywords: [
      "restaurant", "grill", "pizza", "mcdonald", "burger", "taco", "kfc",
      "subway", "chipotle", "doordash", "ubereats", "uber eats", "grubhub",
      "postmates", "seamless", "dining", "kitchen", "sushi", "thai", "bbq",
      "diner", "pub", "wings", "noodle", "ramen", "deli", "bistro", "eatery",
      "wendy", "popeyes", "chick-fil", "chickfil", "panera", "shake shack",
      "five guys", "domino", "papa john", "cheesecake", "olive garden",
      // India
      "swiggy", "zomato", "eatsure", "daalchini", "faasos", "behrouz", "eatfit",
      "box8", "freshmenu", "wow momo", "haldiram", "barbeque nation", "biryani",
      "dhaba", "sweets", "mithai", "bhojanalaya", "chaat", "tiffin", "hospitality",
    ],
  },
  {
    category: "groceries",
    keywords: [
      "grocery", "wholefds", "whole foods", "trader joe", "safeway", "kroger",
      "aldi", "costco", "supermarket", "food lion", "publix", "heb", "sprouts",
      "wegmans", "albertsons", "ralphs", "vons", "meijer", "giant", "stop shop",
      "fresh market", "market",
      // India quick-commerce & grocery
      "zepto", "blinkit", "instamart", "jiomart", "bigbasket", "dunzo", "dmart",
      "country delight", "licious", "otipy", "reliance fresh", "more retail",
      "general store", "kirana", "provision", "vegetable", "sabzi", "dairy",
    ],
  },
  {
    category: "health",
    keywords: [
      "gym", "fitness", "planet fit", "equinox", "lifetime", "crossfit",
      "pharmacy", "cvs", "walgreens", "rite aid", "doctor", "dental", "dentist",
      "clinic", "hospital", "medical", "health", "peloton", "yoga", "pilates",
      "vitamin", "gnc", "optical", "therapy",
      // India
      "apollo", "1mg", "pharmeasy", "netmeds", "medplus", "practo", "cult", "cultfit",
      "diagnostic", "pathology", "max hospital", "fortis", "medanta", "tata 1mg",
    ],
  },
  {
    category: "transport",
    keywords: [
      "uber", "lyft", "shell", "chevron", "exxon", "mobil", "bp ", "gas",
      "fuel", "parking", "metro", "transit", "toll", "mta", "bart", "taxi",
      "76 ", "arco", "marathon", "citgo", "sunoco", "valero", "ev charg",
      "chargepoint", "tesla supercharg",
      // India
      "ola", "rapido", "fastag", "dmrc", "namma metro", "yulu", "blusmart",
      "petrol", "diesel", "hpcl", "bpcl", "indian oil", "ioc", "rickshaw",
    ],
  },
  {
    category: "travel",
    keywords: [
      "airline", "air lines", "delta air", "united air", "southwest", "jetblue",
      "spirit air", "alaska air", "american air", "hotel", "marriott", "hilton",
      "hyatt", "airbnb", "expedia", "booking.com", "vrbo", "hertz", "avis",
      "enterprise rent", "amtrak", "flight", "travel", "resort", "motel",
      // India
      "irctc", "indigo", "vistara", "spicejet", "akasa", "makemytrip", "goibibo",
      "yatra", "cleartrip", "ixigo", "oyo", "redbus", "easemytrip",
    ],
  },
  {
    category: "entertainment",
    keywords: [
      "netflix", "hulu", "spotify", "disney", "hbo", "max ", "youtube",
      "prime video", "cinema", "amc", "movie", "theater", "theatre", "twitch",
      "playstation", "xbox", "steam", "nintendo", "audible", "pandora",
      "paramount", "peacock", "apple music", "apple tv", "ticketmaster",
      "fandango", "concert", "patreon",
      // India
      "hotstar", "jiocinema", "jio cinema", "sonyliv", "zee5", "bookmyshow",
      "gaana", "wynk", "jiosaavn", "altbalaji", "voot", "pvr", "inox",
    ],
  },
  {
    category: "software",
    keywords: [
      "adobe", "github", "openai", "chatgpt", "anthropic", "claude", "notion",
      "dropbox", "google", "microsoft", "icloud", "apple.com", "aws", "amazon web",
      "figma", "zoom", "slack", "atlassian", "godaddy", "namecheap", "vercel",
      "digitalocean", "vpn", "nordvpn", "1password", "grammarly", "canva",
      "linkedin", "substack", "medium", "google cloud", "jetbrains", "cursor",
      "cloudflare", "render", "supabase", "firebase",
    ],
  },
  {
    category: "bills",
    keywords: [
      "at&t", "att ", "verizon", "t-mobile", "tmobile", "comcast", "xfinity",
      "spectrum", "cox ", "centurylink", "electric", "water", "utility",
      "insurance", "geico", "progressive", "state farm", "allstate", "rent",
      "mortgage", "internet", "wireless", "sprint", "pg&e", "con ed", "duke energy",
      // India
      "jio", "airtel", "vodafone", "bsnl", "tata power", "bses", "adani electricity",
      "torrent power", "mahanagar gas", "indane", "act fibernet", "tata play",
      "dish tv", "lic", "postpaid", "broadband",
    ],
  },
  {
    category: "shopping",
    keywords: [
      "amazon", "amzn", "target", "walmart", "ebay", "etsy", "best buy",
      "ikea", "nike", "adidas", "h&m", "zara", "uniqlo", "macy", "nordstrom",
      "home depot", "lowes", "wayfair", "sephora", "ulta", "store", "shop",
      "mall", "marketplace", "boutique", "outlet",
      // India
      "flipkart", "myntra", "ajio", "meesho", "nykaa", "snapdeal", "tatacliq",
      "croma", "reliance digital", "decathlon", "lenskart", "firstcry", "pepperfry",
    ],
  },
  {
    category: "investments",
    keywords: [
      "apy si", "atal pension", "mutual fund", "uti mf", " sip ", "groww", "zerodha",
      "stable broking", "stable finserv", "upstox", "kuvera", "indmoney", "smallcase",
      "broking", "securities", "stockal", "etmoney", "digitalfd", "fixed deposit",
      "recurring deposit", " rd ", "nps ", "ppf", "elss",
    ],
  },
  {
    category: "cash",
    keywords: [
      "atm", "withdrawal", "cash withdraw", "wire", "western union", "moneygram",
    ],
  },
];

function escapeRe(s: string): string {
  return s.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Compile each category's keywords into one word-boundary regex (with optional
// trailing "s"), so "sushi" matches the word "sushi"/"sushis" but NOT "Sushil".
const COMPILED = RULES.map((r) => ({
  category: r.category,
  re: new RegExp(`\\b(?:${r.keywords.map(escapeRe).join("|")})s?\\b`, "i"),
}));

/** Best-guess category for a transaction, based on its raw description. */
export function classify(description: string): Category {
  for (const { category, re } of COMPILED) {
    if (re.test(description)) return category;
  }
  return "other";
}
