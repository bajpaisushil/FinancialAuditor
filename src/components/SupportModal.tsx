"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { HeartIcon, XIcon } from "./icons";
import { money } from "@/lib/format";
import { PAYMENT_PAGE_URL, UPI_ID, UPI_TIERS, inr, upiLink } from "@/lib/support";

/**
 * Everything is free. This is a pay-what-you-want UPI tip — no paywall, no
 * lockout, no server. On mobile the button opens any UPI app; on desktop we
 * render a UPI QR (generated locally, so it works offline too).
 */
export default function SupportModal({
  open,
  onClose,
  annualSavings,
}: {
  open: boolean;
  onClose: () => void;
  annualSavings: number;
}) {
  const [pickedIdx, setPickedIdx] = useState(1);
  const [qr, setQr] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const amount = UPI_TIERS[pickedIdx].amount;
  const link = upiLink(amount);

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

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(link, { margin: 1, width: 220, color: { dark: "#0b1512", light: "#e8f0ed" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [open, link]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="animate-rise max-h-[92vh] w-full max-w-md overflow-y-auto scroll-slim rounded-2xl border border-border bg-surface shadow-2xl"
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
          <h2 className="mt-4 text-xl font-semibold tracking-tight">This will always be free.</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            No account, no paywall, no upsell on your data — there literally is no server to charge
            you from.
            {annualSavings > 0 ? (
              <>
                {" "}You just spotted{" "}
                <span className="font-semibold text-accent">{money(annualSavings)}/yr</span> of
                recurring spend. If the app earned back a fraction of one cancelled subscription,
                that&apos;s a fair trade.
              </>
            ) : (
              <> If it ever saves you money, a small UPI tip keeps it alive.</>
            )}
          </p>
        </div>

        <div className="p-6">
          {PAYMENT_PAGE_URL && (
            <a
              href={PAYMENT_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-bg transition hover:bg-accent-deep"
            >
              <HeartIcon className="h-4.5 w-4.5" /> Contribute (cards / UPI)
            </a>
          )}
          <div className="grid grid-cols-3 gap-2.5">
            {UPI_TIERS.map((t, i) => (
              <button
                key={i}
                onClick={() => setPickedIdx(i)}
                className={`flex flex-col items-center rounded-xl border px-2 py-3 text-center transition ${
                  pickedIdx === i ? "border-accent bg-accent-dim/60" : "border-border bg-surface-2 hover:border-accent/40"
                }`}
              >
                <span className="text-lg font-semibold tabular">{inr(t.amount)}</span>
                <span className="mt-0.5 text-xs font-medium">{t.label}</span>
                <span className="mt-0.5 text-[10px] text-faint">{t.note}</span>
              </button>
            ))}
          </div>

          {/* QR for desktop (scan with any UPI app) */}
          {qr && (
            <div className="mt-5 flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt={`UPI QR to pay ${inr(amount)}`} className="rounded-lg" width={180} height={180} />
              <p className="mt-2 text-xs text-faint">Scan with any UPI app to pay {inr(amount)}</p>
            </div>
          )}

          {/* Button for mobile (opens the UPI app directly) */}
          <a
            href={link}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-bg transition hover:bg-accent-deep"
          >
            <HeartIcon className="h-4.5 w-4.5" />
            Pay {inr(amount)} via UPI
          </a>

          <button
            onClick={() => {
              navigator.clipboard?.writeText(UPI_ID).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-muted transition hover:text-text"
          >
            {copied ? "Copied!" : <>UPI ID: <span className="font-mono text-text">{UPI_ID}</span></>}
          </button>

          <button
            onClick={onClose}
            className="mt-2 w-full rounded-xl px-4 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-text"
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
