// SERVER ONLY. Uses the Razorpay secret + Node crypto — never import from a
// client component.
import crypto from "node:crypto";

/** ₹10 unlock for Smarter Categories. Amount is fixed server-side (in paise). */
export const PRICE_PAISE = 1000;
export const PRICE_INR = 10;

/**
 * Verify a Razorpay payment is genuine: the signature is an HMAC-SHA256 of
 * "<order_id>|<payment_id>" keyed with the account secret. Only Razorpay (and
 * our server) can produce it, so a matching signature proves the payment
 * happened. Constant-time comparison avoids leaking via timing.
 */
export function verifyRazorpaySignature(p: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret: string;
}): boolean {
  const { orderId, paymentId, signature, secret } = p;
  if (!orderId || !paymentId || !signature || !secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
