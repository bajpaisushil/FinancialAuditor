"use client";

import { useEffect, useState } from "react";
import { CoffeeIcon, HeartIcon, XIcon } from "./icons";
import { getCurrency, money } from "@/lib/format";

/**
 * Everything is free. This is a pay-what-you-want ask, framed around the
 * money the user just found. No paywall, no lockout — only a nudge.
 *
 * Swap DONATE_URL for your Ko-fi / Buy Me a Coffee / Stripe Payment Link.
 */
const DONATE_URL = "https://www.buymeacoffee.com/";

const NOTES = ["Keeps the lights on", "Most popular", "You found way more"];
const LABELS = ["A coffee", "Nice one", "Legend"];

/** Sensible round donation amounts per currency (small / medium / large). */
const TIER_AMOUNTS: Record<string, [number, number, number]> = {
  USD: [3, 9, 25], EUR: [3, 8, 20], GBP: [3, 8, 20], INR: [99, 299, 799],
  AUD: [5, 12, 30], CAD: [5, 12, 30], NZD: [5, 12, 30], SGD: [4, 12, 30],
  JPY: [300, 900, 2500], KRW: [4000, 9000, 25000], CNY: [20, 60, 150],
  BRL: [9, 29, 79], ZAR: [50, 150, 400], AED: [12, 35, 90], SAR: [12, 35, 90],
  MXN: [60, 180, 450], TRY: [90, 290, 790], IDR: [40000, 120000, 350000],
  MYR: [12, 35, 90], THB: [99, 290, 790], PHP: [150, 450, 1200],
  NGN: [2000, 6000, 16000], PKR: [500, 1500, 4000], CHF: [3, 8, 20],
};

function tiersFor(currency: string) {
  const amounts = TIER_AMOUNTS[currency] ?? TIER_AMOUNTS.USD;
  return amounts.map((amount, i) => ({
    amount,
    label: LABELS[i],
    note: NOTES[i],
    highlight: i === 1,
  }));
}

export default function SupportModal({
  open,
  onClose,
  annualSavings,
}: {
  open: boolean;
  onClose: () => void;
  annualSavings: number;
}) {
  const currency = getCurrency();
  const tiers = tiersFor(currency);
  const [pickedIdx, setPickedIdx] = useState<number | null>(1);
  const picked = pickedIdx === null ? null : tiers[pickedIdx].amount;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const href = picked ? `${DONATE_URL}?amount=${picked}` : DONATE_URL;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="animate-rise w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-border-soft bg-gradient-to-b from-accent-dim/40 to-transparent p-6">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-md p-1 text-faint transition hover:bg-surface-2 hover:text-text"
            aria-label="Close"
          >
            <XIcon className="h-5 w-5" />
          </button>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-dim text-accent">
            <HeartIcon className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">
            This will always be free.
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            No account, no paywall, no upsell on your data — there literally is no
            server to charge you from.
            {annualSavings > 0 ? (
              <>
                {" "}You just spotted{" "}
                <span className="font-semibold text-accent">{money(annualSavings)}/yr</span>{" "}
                of recurring spend. If the app earned a fraction of one cancelled
                subscription, that&apos;s a fair trade.
              </>
            ) : (
              <> If it ever saves you money, you can throw a few bucks back.</>
            )}
          </p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-3 gap-2.5">
            {tiers.map((t, i) => (
              <button
                key={i}
                onClick={() => setPickedIdx(i)}
                className={`flex flex-col items-center rounded-xl border px-2 py-3 text-center transition ${
                  pickedIdx === i
                    ? "border-accent bg-accent-dim/60"
                    : "border-border bg-surface-2 hover:border-accent/40"
                }`}
              >
                <span className="text-lg font-semibold tabular">{money(t.amount, { cents: false })}</span>
                <span className="mt-0.5 text-xs font-medium">{t.label}</span>
                <span className="mt-0.5 text-[10px] text-faint">{t.note}</span>
              </button>
            ))}
          </div>

          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-bg transition hover:bg-accent-deep"
          >
            <CoffeeIcon className="h-4.5 w-4.5" />
            {picked ? `Chip in ${money(picked, { cents: false })}` : "Chip in"}
          </a>

          <button
            onClick={onClose}
            className="mt-2.5 w-full rounded-xl px-4 py-2.5 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-text"
          >
            Maybe later — keep using it free
          </button>

          <p className="mt-3 text-center text-[11px] leading-relaxed text-faint">
            100% optional. Closing this changes nothing — every feature stays unlocked.
          </p>
        </div>
      </div>
    </div>
  );
}
