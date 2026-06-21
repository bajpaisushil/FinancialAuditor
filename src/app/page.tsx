import Auditor from "@/components/Auditor";
import ExportGuide from "@/components/ExportGuide";
import Logo from "@/components/Logo";
import { PAYMENT_PAGE_URL, UPI_ID, upiLink } from "@/lib/support";
import {
  ArrowRightIcon,
  BoltIcon,
  EyeOffIcon,
  HeartIcon,
  LockIcon,
  RepeatIcon,
  ShieldIcon,
  TrendUpIcon,
  WifiOffIcon,
} from "@/components/icons";

export default function Home() {
  return (
    <main className="backdrop-vault flex-1">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border-soft/60 bg-bg/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Logo className="h-7 w-7" />
            <span className="font-semibold tracking-tight">AuditKosh</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted sm:flex">
            <a href="#how" className="transition hover:text-text">How it works</a>
            <a href="#export" className="transition hover:text-text">Get your statement</a>
            <a href="#why" className="transition hover:text-text">Why trust it</a>
            <a href="#faq" className="transition hover:text-text">FAQ</a>
          </nav>
          <a
            href="#auditor"
            className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-bg transition hover:bg-accent-deep"
          >
            Scan free
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pt-16 pb-10 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
            <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            Zero servers · Zero accounts · Zero data collected
          </div>

          <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            Find the subscriptions
            <br className="hidden sm:block" /> quietly{" "}
            <span className="text-accent">bleeding you dry</span>.
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted">
            Drop your bank statement. We surface every recurring charge and sneaky
            price hike — without you ever linking a bank account, creating a login,
            or sending a single byte to anyone.
          </p>

          <div className="mx-auto mt-7 flex max-w-md items-center justify-center gap-3">
            <a
              href="#auditor"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-bg transition hover:bg-accent-deep"
            >
              Scan my statement <ArrowRightIcon className="h-4 w-4" />
            </a>
            <a
              href="#why"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-medium text-muted transition hover:text-text"
            >
              Why it&apos;s safe
            </a>
          </div>

          {/* The signature hook */}
          <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-2.5 rounded-xl border border-accent/25 bg-accent-dim/30 px-4 py-3 text-sm">
            <WifiOffIcon className="h-5 w-5 shrink-0 text-accent" />
            <span className="text-pretty text-left text-muted">
              <span className="font-medium text-text">Don&apos;t trust us? Turn off your Wi-Fi first.</span>{" "}
              It works exactly the same — because there&apos;s nowhere for your data to go.
            </span>
          </div>
        </div>
      </section>

      {/* The tool */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <Auditor />
      </section>

      {/* Why trust it */}
      <section id="why" className="border-y border-border-soft bg-bg-soft/40 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <SectionTitle
            kicker="The trust problem"
            title="Other apps fix your money by taking your bank login."
            sub="Rocket Money, Mint and the rest route your real credentials through Plaid, then keep a copy of every transaction you ever make. AuditKosh takes a different bet: the safest data is the data we never receive."
          />

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            <CompareCard
              tone="bad"
              title="The Plaid way"
              points={[
                "You hand over your actual bank username & password",
                "Your transaction history is copied to their servers",
                "Data can be sold, breached, or harvested for ads",
                "You need an account, and cancelling is a maze",
              ]}
            />
            <CompareCard
              tone="good"
              title="The AuditKosh way"
              points={[
                "You export a CSV — a file you already own",
                "It's parsed in your browser tab and never uploaded",
                "Nothing to breach, because nothing is stored",
                "No login, no email, close the tab and it's gone",
              ]}
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20">
        <div className="mx-auto max-w-6xl px-5">
          <SectionTitle
            kicker="How it works"
            title="Three steps. Your data never leaves the room."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <StepCard
              n="01"
              icon={<LockIcon className="h-5 w-5" />}
              title="Export & drop"
              body="Download a CSV from your bank or card and drag it in. No connecting accounts, no OAuth, no Plaid."
            />
            <StepCard
              n="02"
              icon={<BoltIcon className="h-5 w-5" />}
              title="We scan locally"
              body="JavaScript in your browser groups merchants, measures the gaps between charges, and flags what repeats."
            />
            <StepCard
              n="03"
              icon={<TrendUpIcon className="h-5 w-5" />}
              title="See the bleed"
              body="Get every subscription, its true monthly cost, and any silent price hikes — then go cancel the dead ones."
            />
          </div>
        </div>
      </section>

      {/* Where to get your statement */}
      <ExportGuide />

      {/* What makes it different */}
      <section className="border-y border-border-soft bg-bg-soft/40 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <SectionTitle
            kicker="What's actually new here"
            title="Privacy wasn't the feature people gave up. It was the price of entry."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<EyeOffIcon className="h-5 w-5" />}
              title="Provably private"
              body="Most apps say 'we value your privacy.' We let you prove it — kill your network connection and run the whole audit offline."
            />
            <FeatureCard
              icon={<RepeatIcon className="h-5 w-5" />}
              title="Smart recurrence engine"
              body="It doesn't just keyword-match 'Netflix.' It clusters messy merchant strings and scores how rhythmically each one repeats."
            />
            <FeatureCard
              icon={<TrendUpIcon className="h-5 w-5" />}
              title="Price-hike radar"
              body="The thing subscriptions count on you not noticing: the slow creep. We chart each charge and call out the increase."
            />
            <FeatureCard
              icon={<ShieldIcon className="h-5 w-5" />}
              title="No backend to breach"
              body="There is no database with your name in it. The most secure architecture is the one that doesn't exist."
            />
            <FeatureCard
              icon={<BoltIcon className="h-5 w-5" />}
              title="Instant, no signup"
              body="No 'create an account to see your results' wall. Drop the file, read the numbers, close the tab."
            />
            <FeatureCard
              icon={<HeartIcon className="h-5 w-5" />}
              title="Free, genuinely"
              body="Every feature is unlocked for everyone. If it saves you money, you can tip — but you never have to."
            />
          </div>
        </div>
      </section>

      {/* Support / pay-what-you-want */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-5">
          <div className="relative overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-accent-dim/40 via-surface to-surface p-8 text-center sm:p-12">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-dim text-accent">
              <HeartIcon className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              No paywall. Just a tip jar.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-pretty text-muted">
              AuditKosh is free and always will be — there&apos;s no server to bill you
              from. If it just found you a few hundred rupees of forgotten charges,
              a small UPI tip keeps it alive and ad-free.
            </p>
            <a
              href={PAYMENT_PAGE_URL || upiLink()}
              {...(PAYMENT_PAGE_URL ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-bg transition hover:bg-accent-deep"
            >
              <HeartIcon className="h-4 w-4" /> {PAYMENT_PAGE_URL ? "Contribute" : "Tip via UPI"}
            </a>
            <p className="mt-3 text-xs text-faint">
              {PAYMENT_PAGE_URL ? (
                "100% optional · the tool stays fully unlocked either way"
              ) : (
                <>
                  or pay to <span className="font-mono text-muted">{UPI_ID}</span> · 100% optional, fully unlocked either way
                </>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border-soft bg-bg-soft/40 py-20">
        <div className="mx-auto max-w-3xl px-5">
          <SectionTitle kicker="FAQ" title="The questions a skeptic asks." />
          <div className="mt-10 space-y-3">
            <Faq
              q="How do I know my data isn't being uploaded?"
              a="Open your browser's network tab, or just disconnect from the internet entirely, then run a scan. It works identically offline — there's no request to a server because there is no server."
            />
            <Faq
              q="What file do I give it?"
              a="A CSV or PDF statement from your bank, card or wallet. CSV is the most accurate (we auto-detect the date, description and amount columns), but you can also drop a PDF — we read its text right in your browser. Scanned/image-only PDFs won't work; use a CSV in that case."
            />
            <Faq
              q="Does it store anything between visits?"
              a="No. Everything lives in the page's memory while the tab is open. Refresh or close it and the data is gone for good. Nothing is written to a server or to long-term storage."
            />
            <Faq
              q="Is it really free? What's the catch?"
              a="It's genuinely free, with no locked features. The only ask is an optional tip if it saved you money. Because there's no backend, there are no per-user costs to recover."
            />
            <Faq
              q="How accurate is the detection?"
              a="Each charge group gets a confidence score from how regularly it repeats and how stable the amount is. Statements covering 3+ months give the best results. Always sanity-check before cancelling."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-soft py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-faint sm:flex-row">
          <div className="flex items-center gap-2">
            <Logo className="h-6 w-6" />
            <span className="font-medium text-muted">AuditKosh</span>
            <span>· your statement never left this device</span>
          </div>
          <div className="flex items-center gap-1.5">
            <WifiOffIcon className="h-4 w-4 text-accent" />
            <span>Built to work with the Wi-Fi off.</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

function SectionTitle({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="text-xs font-semibold uppercase tracking-widest text-accent">{kicker}</div>
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {sub && <p className="mx-auto mt-4 max-w-xl text-pretty text-muted">{sub}</p>}
    </div>
  );
}

function StepCard({ n, icon, title, body }: { n: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-dim text-accent">{icon}</div>
        <span className="font-mono text-sm text-faint">{n}</span>
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 transition hover:border-accent/30">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-dim text-accent">{icon}</div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function CompareCard({ tone, title, points }: { tone: "good" | "bad"; title: string; points: string[] }) {
  const good = tone === "good";
  return (
    <div
      className={`rounded-xl border p-6 ${
        good ? "border-accent/30 bg-accent-dim/20" : "border-border bg-surface"
      }`}
    >
      <h3 className={`font-semibold ${good ? "text-accent" : "text-muted"}`}>{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {points.map((p, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                good ? "bg-accent text-bg" : "bg-danger/20 text-danger"
              }`}
            >
              {good ? "✓" : "✕"}
            </span>
            <span className={good ? "text-text" : "text-muted"}>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-border bg-surface p-5 [&_summary]:cursor-pointer">
      <summary className="flex items-center justify-between font-medium marker:content-['']">
        {q}
        <span className="ml-4 text-faint transition group-open:rotate-45">+</span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-muted">{a}</p>
    </details>
  );
}
