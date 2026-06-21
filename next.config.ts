import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const nextConfig: NextConfig = {
  // Pages are still fully static/client-side (statements never leave the device,
  // and the service worker keeps the app working offline). We no longer emit a
  // pure static export because payment verification needs two tiny serverless
  // Route Handlers (/api/order, /api/verify) that hold the Razorpay secret —
  // Route Handlers aren't supported under `output: "export"`. Only those payment
  // endpoints run on a server; everything else is prerendered + offline.
  images: { unoptimized: true },
  // Pin the workspace root so Next stops guessing when stray lockfiles exist higher up.
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
};

export default nextConfig;
