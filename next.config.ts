import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const nextConfig: NextConfig = {
  // The whole app is static + client-side (no server, by design), so export a
  // plain static site. Deploys anywhere — Cloudflare Pages, Netlify, GitHub
  // Pages — with no server runtime, matching the "nothing leaves your device"
  // promise. Output goes to ./out.
  output: "export",
  images: { unoptimized: true },
  // Pin the workspace root so Next stops guessing when stray lockfiles exist higher up.
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
};

export default nextConfig;
