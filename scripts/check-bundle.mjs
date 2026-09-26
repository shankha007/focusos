/**
 * Fails the build when what a visitor downloads grows past budget.
 *
 * Two numbers are checked, both measured from the real build output rather
 * than estimated:
 *
 *   landing   The gzipped JavaScript a first-time visitor downloads to read "/":
 *             the entry script plus everything index.html preloads. This was
 *             359 KB before the landing page was split from the app, and a
 *             single `manualChunks` entry was enough to quietly add 103 KB of
 *             charting back onto it — nothing but a number like this notices.
 *
 *   precache  Everything the service worker stores on a first visit. It was
 *             2,173 KB before the PDF machinery was moved to a runtime cache.
 *
 * Vite already prints a chunk-size warning, and it has been printing it on every
 * build for months without anyone acting on it. A warning is not a gate.
 *
 * Run after `vite build`: `node scripts/check-bundle.mjs`
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';

/**
 * Headroom over the figures at the time the budgets were set. Landing was
 * lowered from 180 KB once Radix, Framer Motion and the secondary marketing
 * pages came off it (165 KB -> 89 KB), so the saving cannot quietly erode.
 * Precache was lowered from 1,500 KB when Recharts was replaced by a small
 * SVG chart (1,494 KB -> 1,128 KB), and again to 1,100 KB when Framer Motion
 * gave way to CSS (-> 1,023 KB), for the same reason.
 */
const BUDGETS = {
  landingGzipKb: 100,
  precacheKb: 1100,
};

const read = (file) => readFileSync(join(DIST, file.replace(/^\//, '')));
const kb = (bytes) => bytes / 1024;

/* ── Landing page ──────────────────────────────────────────── */

const html = read('index.html').toString('utf8');
const entryScripts = [...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)].map((m) => m[1]);
const preloads = [...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
const landingFiles = [...new Set([...entryScripts, ...preloads])];

if (landingFiles.length === 0) {
  console.error('check-bundle: found no entry script in dist/index.html — has the build run?');
  process.exit(1);
}

const landing = landingFiles.map((file) => ({ file, gzipKb: kb(gzipSync(read(file)).length) }));
const landingKb = landing.reduce((total, f) => total + f.gzipKb, 0);

/* ── Precache ──────────────────────────────────────────────── */

const sw = read('sw.js').toString('utf8');
const precached = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]);
let precacheBytes = 0;
const missing = [];
for (const url of precached) {
  try {
    precacheBytes += statSync(join(DIST, url.replace(/^\//, ''))).size;
  } catch {
    missing.push(url);
  }
}
const precacheKb = kb(precacheBytes);

/* ── Report ────────────────────────────────────────────────── */

const row = (label, value, budget) => {
  const over = value > budget;
  const status = over ? 'OVER' : 'ok';
  console.log(`  ${label.padEnd(10)} ${value.toFixed(1).padStart(8)} KB   budget ${String(budget).padStart(5)} KB   ${status}`);
  return over;
};

console.log('\nBundle budget');
const landingOver = row('landing', landingKb, BUDGETS.landingGzipKb);
const precacheOver = row('precache', precacheKb, BUDGETS.precacheKb);

console.log('\n  landing page loads:');
for (const f of landing.sort((a, b) => b.gzipKb - a.gzipKb)) {
  console.log(`    ${f.gzipKb.toFixed(1).padStart(7)} KB gz  ${f.file}`);
}
console.log(`\n  precache: ${precached.length} entries\n`);

if (missing.length > 0) {
  console.error(`check-bundle: the service worker lists files that are not in dist: ${missing.join(', ')}`);
  process.exit(1);
}

if (landingOver || precacheOver) {
  console.error(
    'check-bundle: over budget. If the growth is intended, raise the budget in scripts/check-bundle.mjs ' +
      'in the same change, so the decision is visible in review rather than made by accident.',
  );
  process.exit(1);
}
