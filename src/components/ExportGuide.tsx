import { EyeOffIcon, FileIcon } from "./icons";

interface Provider {
  name: string;
  badge: string;
  steps: string[];
  format: string;
}

const PROVIDERS: Provider[] = [
  {
    name: "Paytm",
    badge: "PT",
    steps: [
      "Open Paytm → tap your profile → Balance & History",
      "Tap Download Statement and pick a date range (3+ months is best)",
      "Choose Excel / CSV — it's emailed to you, then upload that file here",
    ],
    format: "CSV / Excel",
  },
  {
    name: "PhonePe",
    badge: "PP",
    steps: [
      "Open PhonePe → History",
      "Tap the statement / download icon and select a date range",
      "Download the statement and drop it in above",
    ],
    format: "CSV / PDF",
  },
  {
    name: "Google Pay",
    badge: "GP",
    steps: [
      "GPay → Profile → Settings → Download transaction history",
      "It exports via Google Takeout as a CSV",
      "Upload the CSV here — nothing goes back to Google or us",
    ],
    format: "CSV",
  },
  {
    name: "Your bank (net banking)",
    badge: "BK",
    steps: [
      "Log in to net banking → Accounts → Statement / Transactions",
      "Pick a date range and choose Download as CSV or Excel",
      "Upload the file — no need to connect the account to anything",
    ],
    format: "CSV / Excel",
  },
  {
    name: "Credit card",
    badge: "CC",
    steps: [
      "Open your card app or web portal → Statements / Activity",
      "Use Export / Download transactions and choose CSV",
      "Drop the export here to see every recurring charge",
    ],
    format: "CSV",
  },
  {
    name: "PayPal",
    badge: "PY",
    steps: [
      "paypal.com → Activity → Download",
      "Choose CSV and a date range, then Create Report",
      "Upload the downloaded CSV above",
    ],
    format: "CSV",
  },
];

export default function ExportGuide() {
  return (
    <section id="export" className="py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-widest text-accent">
            Get your statement
          </div>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Export from anywhere. Track your spending. Tell no one.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-muted">
            Almost every wallet, bank and card lets you download your own history as a
            file. Export it, drop it here, and read your numbers — the file is opened
            inside your browser and shared with absolutely no one, including us.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROVIDERS.map((p) => (
            <div key={p.name} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-dim text-xs font-bold text-accent">
                    {p.badge}
                  </span>
                  <span className="font-semibold">{p.name}</span>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-soft px-2 py-0.5 text-[10px] text-faint">
                  <FileIcon className="h-3 w-3" /> {p.format}
                </span>
              </div>
              <ol className="mt-4 space-y-2.5">
                {p.steps.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-muted">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-accent">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-8 flex max-w-2xl items-center justify-center gap-2.5 rounded-xl border border-accent/25 bg-accent-dim/30 px-4 py-3 text-sm">
          <EyeOffIcon className="h-5 w-5 shrink-0 text-accent" />
          <span className="text-pretty text-muted">
            <span className="font-medium text-text">Only got a PDF or Excel?</span>{" "}
            Open it in any spreadsheet app and &ldquo;Save As / Export CSV&rdquo; — that file
            works here too. It still never leaves your device.
          </span>
        </div>
      </div>
    </section>
  );
}
