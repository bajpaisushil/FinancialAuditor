/** Where tips go. A UPI VPA is safe to ship publicly — it only receives money. */
export const UPI_ID = "sushilbajpai2003-2@oksbi";
export const PAYEE_NAME = "AuditKosh";

/** Contact for bug reports / feature requests / unsupported-bank reports. */
export const FEEDBACK_EMAIL = "avaranai108@gmail.com";

/**
 * Optional hosted payment page (e.g. https://razorpay.me/@auditkosh).
 * A personal UPI VPA always shows your bank-registered NAME to the payer
 * (UPI/NPCI shows the verified beneficiary — the `pn`/QR can't override it).
 * A Razorpay/PSP payment page shows your chosen BUSINESS name instead, so it's
 * anonymous. Paste that public URL here and it becomes the primary tip button.
 */
export const PAYMENT_PAGE_URL: string = "";

/** Build a UPI deep link — opens any UPI app on mobile; encodes as a QR on desktop. */
export function upiLink(amount?: number): string {
  const params = new URLSearchParams({ pa: UPI_ID, pn: PAYEE_NAME, cu: "INR" });
  if (amount && amount > 0) params.set("am", String(amount));
  params.set("tn", "AuditKosh support");
  return `upi://pay?${params.toString()}`;
}

/** Suggested pay-what-you-want tiers (₹), since UPI settles in INR. */
export const UPI_TIERS = [
  { amount: 49, label: "A chai", note: "Keeps it alive" },
  { amount: 99, label: "Nice one", note: "Most popular", highlight: true },
  { amount: 299, label: "Legend", note: "You found way more" },
];

export function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}
