/**
 * Workaround for Next.js 16 issue #85374:
 * https://github.com/vercel/next.js/issues/85374
 *
 * In `output: "export"` mode, Next.js 16 writes RSC segment payloads as nested
 * directories (e.g. `out/register/__next.!KGF1dGgp/register.txt`), but the
 * client-side router requests them as flat, dot-separated filenames
 * (e.g. `/register/__next.!KGF1dGgp.register.txt`).
 *
 * On Capacitor Android the asset loader serves files from the APK assets,
 * which cannot redirect the mismatched paths -> every `<Link>` prefetch
 * 404s, which then crashes the WebView.
 *
 * This script walks the `out/` directory, finds any child directory whose
 * name starts with `__next`, recursively collects the files inside it, and
 * copies them up into the parent directory using dot-separated names.
 *
 * Safe to run multiple times (idempotent).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "out");

if (!fs.existsSync(OUT_DIR)) {
  console.error(`[fix-rsc-paths] "${OUT_DIR}" not found. Did you run "next build"?`);
  process.exit(1);
}

let flattened = 0;

/**
 * Recursively collect every file inside `dir`, returning objects that describe
 * where each file should land relative to the `__next.*` directory's parent.
 */
function collectFiles(dir, relativeParts = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(abs, [...relativeParts, entry.name]));
    } else if (entry.isFile()) {
      results.push({
        absolutePath: abs,
        relativeParts: [...relativeParts, entry.name],
      });
    }
  }
  return results;
}

/**
 * Walk every directory inside `out/` looking for immediate children whose name
 * starts with `__next`. For each, flatten its contents up into the parent.
 */
function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;

    if (entry.name.startsWith("__next")) {
      const files = collectFiles(abs);
      for (const { absolutePath, relativeParts } of files) {
        const flatName = [entry.name, ...relativeParts].join(".");
        const target = path.join(dir, flatName);
        if (!fs.existsSync(target)) {
          fs.copyFileSync(absolutePath, target);
          flattened++;
        }
      }
      continue;
    }

    walk(abs);
  }
}

walk(OUT_DIR);

console.log(
  `[fix-rsc-paths] Flattened ${flattened} RSC segment file${flattened === 1 ? "" : "s"} in ${path.relative(
    process.cwd(),
    OUT_DIR,
  )}`,
);
