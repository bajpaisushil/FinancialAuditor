import { NextResponse } from "next/server";
import { PRICE_PAISE } from "@/lib/razorpay";

// Holds the secret + talks to Razorpay, so it must run on a server (not static).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Create a ₹10 Razorpay order. The amount is fixed here (server-side) so the
 * client can't tamper with the price. Returns the order id + the PUBLIC key id
 * for Checkout; the secret never leaves the server.
 */
export async function POST() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: "Payments aren’t configured on the server." },
      { status: 500 }
    );
  }

  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: PRICE_PAISE,
        currency: "INR",
        notes: { product: "AuditKosh — Smarter categories" },
      }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Could not create the order." }, { status: 502 });
    }
    const order = (await res.json()) as { id: string; amount: number; currency: string };
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the payment provider." }, { status: 502 });
  }
}
