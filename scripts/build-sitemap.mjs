/**
 * Writes dist/sitemap.xml from the route table below.
 *
 * It used to be a hand-written file in public/, which meant `lastmod` was
 * whatever someone last remembered to type — it read 2026-09-03 while the page
 * had changed several times since. A date that is wrong in that direction is
 * worse than no date: it tells a crawler there is nothing new to fetch.
 *
 * Run after `vite build`, which is what `npm run build` does. Vite copies
 * public/ verbatim, so sitemap.xml no longer lives there; this is its only
 * source.
 *
 * Phase 4 of the SEO plan adds pre-rendered marketing routes. Each one gets an
 * entry here, and `sources` is what makes its date honest.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ORIGIN = 'https://focusos.pro';
const DIST = 'dist';

/**
 * Only pages worth a crawler's time. The application routes are deliberately
 * absent: they render the visitor's own local data and carry
 * `X-Robots-Tag: noindex` (see vercel.json), so listing them would be asking
 * for a crawl of something we have just asked not to be indexed.
 *
 * `sources` are the files whose last commit dates the page. A page is as fresh
 * as the newest file that renders it.
 */
const ROUTES = [
  {
    path: '/',
    changefreq: 'weekly',
    priority: '1.0',
    sources: ['index.html', 'src/features/landing/LandingPage.tsx', 'src/features/landing/content.ts'],
  },
];

/** `git log` date of the newest commit touching any of `files`, as YYYY-MM-DD. */
function lastCommitDate(files) {
  const dates = files
    .map((file) => {
      try {
        return execFileSync('git', ['log', '-1', '--format=%cs', '--', file], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
      } catch {
        // No git, or no history for this path.
        return '';
      }
    })
    .filter(Boolean);

  if (dates.length > 0) return dates.sort().at(-1);

  // Vercel and actions/checkout both clone shallow, so per-file history is
  // often a single commit deep or missing entirely. HEAD's own date is the next
  // best answer, and the build date after that — both are "when this deploy was
  // made", which is never a lie about freshness, only imprecise.
  try {
    return execFileSync('git', ['log', '-1', '--format=%cs'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

const entries = ROUTES.map(({ path, changefreq, priority, sources }) => {
  const lastmod = lastCommitDate(sources);
  return [
    '  <url>',
    `    <loc>${ORIGIN}${path}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n');
});

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...entries,
  '</urlset>',
  '',
].join('\n');

writeFileSync(join(DIST, 'sitemap.xml'), xml, 'utf8');
console.log(`build-sitemap: wrote ${ROUTES.length} URL(s) to ${DIST}/sitemap.xml`);
