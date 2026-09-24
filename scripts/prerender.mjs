/**
 * Writes each marketing route out as real HTML.
 *
 * `/` used to be an empty <div id="root"> plus a hand-written summary of the
 * page kept in step by hand — the "#seo-shell". A crawler that does not execute
 * JavaScript saw the summary; everyone else saw the summary flash and then the
 * real page. This renders the actual components instead, so the HTML a crawler
 * downloads is the page, and the browser hydrates what it already painted.
 *
 * Runs after `vite build`, from `npm run build`:
 *   1. bundle src/entry-ssr.tsx for Node (vite.ssr.config.ts)
 *   2. render each route in src/features/landing/routes.ts
 *   3. splice the markup and that route's head tags into dist/index.html
 *   4. write dist/<route>/index.html
 *
 * One consequence worth knowing: vite-plugin-pwa has already written its
 * precache manifest by the time this rewrites index.html, so the revision it
 * recorded is the hash of the pre-render version. That is only a cache key, and
 * it changes whenever the bundle does — which is whenever this output could
 * differ — so the worst case is a rebuild with byte-identical JS and different
 * copy, which does not happen in practice because the copy is in the JS.
 */
import { build } from 'vite';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const DIST = 'dist';
const SSR_DIR = '.prerender';

/** Escapes what goes into an HTML attribute. Titles and descriptions are prose and will contain quotes. */
const attr = (value) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Replaces the head tags that differ per page.
 *
 * Deliberately narrow: it rewrites the value of tags the template already
 * carries rather than assembling a head of its own, so anything added to
 * index.html — a preconnect, a new meta — survives without this script knowing
 * about it.
 */
/**
 * Matches a meta tag's content attribute by its name or property.
 *
 * Built as a pattern rather than matched literally because index.html wraps
 * these tags across several lines — `<meta` on one, the key on the next, the
 * content after that — and a regex written against one formatting of the file
 * is a trap for whoever reformats it.
 */
function metaContent(kind, key) {
  return new RegExp(String.raw`(<meta\s+${kind}="${key}"\s+content=")[^"]*(")`, 's');
}

function withHead(html, route, canonical) {
  const replacements = [
    [/<title>[^<]*<\/title>/, `<title>${attr(route.title)}</title>`],
    [metaContent('name', 'description'), `$1${attr(route.description)}$2`],
    [/(<link rel="canonical" href=")[^"]*(")/, `$1${canonical}$2`],
    [metaContent('property', 'og:url'), `$1${canonical}$2`],
    [metaContent('property', 'og:title'), `$1${attr(route.title)}$2`],
    [metaContent('property', 'og:description'), `$1${attr(route.description)}$2`],
    [metaContent('name', 'twitter:title'), `$1${attr(route.title)}$2`],
    [metaContent('name', 'twitter:description'), `$1${attr(route.description)}$2`],
  ];

  return replacements.reduce((acc, [pattern, replacement]) => {
    if (!pattern.test(acc)) {
      // A template that stopped carrying one of these would silently publish
      // every page with the same tag, which is exactly the problem this phase
      // exists to fix.
      throw new Error(`prerender: index.html has no tag matching ${pattern}`);
    }
    return acc.replace(pattern, replacement);
  }, html);
}

/**
 * Adds a page's own schema.org block after the site-wide one.
 *
 * Appended rather than substituted: the WebSite, Person and SoftwareApplication
 * nodes in index.html describe entities that are the same on every page, and
 * this block describes the page. Both are valid together, and the page's block
 * references the others by @id rather than restating them.
 */
function withSchema(html, route) {
  if (!route.schema) return html;
  // The PWA plugin appends its manifest link to the head after Vite has
  // formatted the file, so </head> is not where the source put it and carries
  // no predictable indentation.
  if (!html.includes('</head>')) throw new Error('prerender: index.html has no </head>');

  const indented = JSON.stringify(route.schema, null, 2)
    .split('\n')
    .map((line) => `      ${line}`)
    .join('\n');

  const block = [
    '',
    '    <script type="application/ld+json">',
    indented,
    '    </script>',
    '  </head>',
  ].join('\n');

  return html.replace('</head>', block);
}

/** Puts the rendered markup inside #root, which the template leaves empty. */
function withBody(html, markup) {
  const pattern = /<div id="root">\s*<\/div>/;
  if (!pattern.test(html)) {
    throw new Error('prerender: index.html has no empty <div id="root"></div> to render into');
  }
  return html.replace(pattern, `<div id="root">${markup}</div>`);
}

// Imported straight from the app's own table. Node 22 strips the types, so
// there is no build step between the source of truth and the thing that reads
// it — and no second copy of the list to forget to update.
const { MARKETING_ROUTES, canonicalUrl, outputPath } = await import(
  pathToFileURL(join(process.cwd(), 'src/features/landing/routes.ts')).href
);

console.log('prerender: building the SSR bundle');
await build({ configFile: 'vite.ssr.config.ts', logLevel: 'warn' });

const { render } = await import(pathToFileURL(join(process.cwd(), SSR_DIR, 'entry-ssr.js')).href);
const template = readFileSync(join(DIST, 'index.html'), 'utf8');

for (const route of MARKETING_ROUTES) {
  const markup = render(route.path);
  const canonical = canonicalUrl(route.path);
  const html = withBody(withSchema(withHead(template, route, canonical), route), markup);

  const target = join(DIST, outputPath(route.path));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html, 'utf8');
  console.log(`prerender: ${route.path} -> ${outputPath(route.path)} (${(html.length / 1024).toFixed(1)} KB)`);
}

// Nothing downstream reads the Node bundle, and leaving it behind means the
// next `vite build --watch` has a second copy of the app to trip over.
rmSync(SSR_DIR, { recursive: true, force: true });
