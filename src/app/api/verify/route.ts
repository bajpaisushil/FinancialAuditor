import { NextResponse } from "next/server";
import { verifyRazorpaySignature } from "@/lib/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verify a completed Razorpay payment. The client posts back the order id,
 * payment id and signature from Checkout; we confirm the signature with the
 * secret. A valid signature is proof of a real payment — the client can't forge
 * it. Only then does the frontend unlock the feature.
 */
export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    return NextResponse.json({ verified: false, error: "not configured" }, { status: 500 });
  }

  let body: {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ verified: false }, { status: 400 });
  }

  const ok = verifyRazorpaySignature({
    orderId: body.razorpay_order_id ?? "",
    paymentId: body.razorpay_payment_id ?? "",
    signature: body.razorpay_signature ?? "",
    secret,
  });

  return NextResponse.json({ verified: ok }, { status: ok ? 200 : 400 });
}
