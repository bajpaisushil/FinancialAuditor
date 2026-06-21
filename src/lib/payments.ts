// Client-side paywall for Smarter Categories: one free run, then ₹10 to unlock.
//
// The unlock is stored in localStorage. Because the AI runs entirely on-device,
// this gate is necessarily client-side and a determined user can bypass it —
// that's an accepted trade-off for a ₹10 microtransaction. What we DON'T trust
// the client on is the payment itself: the server creates the order and
// verifies the Razorpay signature before we ever set the "paid" flag.

export const SMART_PRICE_INR = 10;

const USED_KEY = "ak_smart_used";
const PAID_KEY = "ak_smart_paid";

export interface Entitlement {
  /** Has the one free run been spent? */
  used: boolean;
  /** Has the user paid to unlock? */
  paid: boolean;
}

export function getEntitlement(): Entitlement {
  try {
    return {
      used: localStorage.getItem(USED_KEY) === "1",
      paid: localStorage.getItem(PAID_KEY) === "1",
    };
  } catch {
    return { used: false, paid: false };
  }
}

export function markUsed(): void {
  try {
    localStorage.setItem(USED_KEY, "1");
  } catch {
    /* private mode / storage disabled — non-fatal */
  }
}

function markPaid(): void {
  try {
    localStorage.setItem(PAID_KEY, "1");
  } catch {
    /* non-fatal */
  }
}

type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
type RazorpayCtor = new (opts: Record<string, unknown>) => {
  open: () => void;
  on: (event: string, cb: () => void) => void;
};

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckout(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = CHECKOUT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn’t load the payment SDK — are you online?"));
    document.head.appendChild(s);
  });
}

/**
 * Run the full pay flow: create an order on our server, open Razorpay Checkout,
 * then verify the result on our server. Resolves true only if the server
 * confirmed the signature (and persists the unlock). Resolves false if the user
 * dismisses or the payment fails. Throws if checkout couldn't even start.
 */
export async function payForSmartCategories(): Promise<boolean> {
  const orderRes = await fetch("/api/order", { method: "POST" });
  if (!orderRes.ok) throw new Error("Couldn’t start checkout. Please try again.");
  const { orderId, amount, currency, keyId } = (await orderRes.json()) as {
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
  };

  await loadCheckout();
  const Razorpay = (window as unknown as { Razorpay: RazorpayCtor }).Razorpay;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const done = (v: boolean) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };

    const rzp = new Razorpay({
      key: keyId,
      order_id: orderId,
      amount,
      currency,
      name: "AuditKosh",
      description: "Unlock Smarter categories",
      theme: { color: "#34d399" },
      handler: async (resp: RazorpayResponse) => {
        try {
          const v = await fetch("/api/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            }),
          });
          const data = (await v.json()) as { verified?: boolean };
          if (v.ok && data.verified) {
            markPaid();
            done(true);
          } else {
            done(false);
          }
        } catch {
          done(false);
        }
      },
      modal: { ondismiss: () => done(false) },
    });
    rzp.on("payment.failed", () => done(false));
    rzp.open();
  });
}
