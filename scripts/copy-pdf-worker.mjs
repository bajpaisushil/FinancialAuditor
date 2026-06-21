// Copies the pdf.js worker into /public so it is served same-origin.
// Runs on postinstall so deploys (Vercel, Netlify) pick it up automatically.
// Keeping the worker on our own origin means no external request is ever made
// to parse a PDF — the whole privacy promise stays intact.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

try {
  const workerPath = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
  const dest = join(root, "public", "pdf.worker.min.mjs");
  mkdirSync(join(root, "public"), { recursive: true });
  copyFileSync(workerPath, dest);
  console.log("✓ Copied pdf.js worker to public/pdf.worker.min.mjs");
} catch (err) {
  console.warn("⚠ Could not copy pdf.js worker:", err.message);
}
