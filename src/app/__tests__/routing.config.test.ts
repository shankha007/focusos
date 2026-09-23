import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MARKETING_ROUTES, outputPath } from '@/features/landing/routes';

/**
 * The router, the hosting config and robots.txt have to agree about which paths
 * are application routes. Nothing in the build notices when they drift, and the
 * failure is invisible from inside the app: a route the router serves but
 * vercel.json does not rewrite answers 404 on a hard refresh, and a route that
 * lost its noindex header quietly becomes indexable.
 *
 * So the list lives in App.tsx and this test holds the other two to it.
 */

const root = join(import.meta.dirname, '..', '..', '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

/**
 * The routes that render the application: every `path="/x"` in App.tsx except
 * "/", the "*" fallback, and the marketing pages, which are pre-rendered and
 * indexed and so have the opposite requirements at every point below.
 */
function appRoutes(): string[] {
  const source = read('src/app/App.tsx');
  const marketing = new Set(MARKETING_ROUTES.map((route) => route.path.replace(/^\//, '')));
  return [...source.matchAll(/<Route path="\/([a-z-]+)"/g)]
    .map((match) => match[1])
    .filter((path) => !marketing.has(path));
}

describe('routing configuration', () => {
  const routes = appRoutes();
  const vercel = read('vercel.json');
  const robots = read('public/robots.txt');

  it('finds the application routes in App.tsx', () => {
    // A rename that this regex stops matching would otherwise make every
    // assertion below vacuously true.
    expect(routes).toEqual(['dashboard', 'tasks', 'analytics', 'achievements', 'settings']);
  });

  it.each(routes)('rewrites /%s to the app shell, not the landing page', (route) => {
    const rewrites = JSON.parse(vercel).rewrites as { source: string; destination: string }[];
    const matching = rewrites.filter((rule) => rule.source.includes(route));
    expect(matching.length).toBeGreaterThan(0);
    // index.html holds the pre-rendered marketing page. Serving it here would
    // paint the landing page and then have React replace it.
    matching.forEach((rule) => expect(rule.destination).toBe('/app.html'));
  });

  it.each(routes)('sends X-Robots-Tag: noindex for /%s', (route) => {
    const headers = JSON.parse(vercel).headers as {
      source: string;
      headers: { key: string; value: string }[];
    }[];
    const rule = headers.find(
      (entry) =>
        entry.source.includes(route) &&
        entry.headers.some((header) => header.key === 'X-Robots-Tag'),
    );
    expect(rule, `no X-Robots-Tag rule covers /${route}`).toBeDefined();
    expect(rule?.headers.find((header) => header.key === 'X-Robots-Tag')?.value).toMatch(/noindex/);
  });

  it.each(routes)('lets the service worker serve the app shell for /%s', (route) => {
    // The worker answers navigations from its own cache. A route missing from
    // the allowlist would be fetched from the network instead, which works
    // online and fails offline — in an app whose whole claim is offline-first.
    const config = read('vite.config.ts');
    const allowlist = config.slice(
      config.indexOf('navigateFallbackAllowlist'),
      config.indexOf('navigateFallbackDenylist'),
    );
    expect(allowlist).toContain(String.raw`/^\/${route}`);
  });

  it('has no catch-all rewrite, so an unknown path can 404', () => {
    const rewrites = JSON.parse(vercel).rewrites as { source: string }[];
    expect(rewrites.some((rule) => rule.source === '/(.*)')).toBe(false);
  });

  it('does not disallow the app routes in robots.txt', () => {
    // Disallow would stop a crawler ever reading the noindex header above,
    // which is what actually keeps these pages out of the index.
    expect(robots).not.toMatch(/^Disallow: \/\w/m);
  });

  it.each(MARKETING_ROUTES.filter((route) => route.path !== '/'))(
    'serves the pre-rendered file for $path',
    (route) => {
      // Vercel resolves a directory index for a request with a trailing slash;
      // the bare path needs saying. Without this the request falls through to
      // the 404 the catch-all rewrite no longer covers.
      const rewrites = JSON.parse(vercel).rewrites as { source: string; destination: string }[];
      const rule = rewrites.find((entry) => entry.source === route.path);
      expect(rule, `no rewrite serves ${route.path}`).toBeDefined();
      expect(rule?.destination).toBe(`/${outputPath(route.path)}`);
    },
  );

  it.each(MARKETING_ROUTES)('does not noindex $path', (route) => {
    // These pages exist to be indexed. The noindex header is scoped to the app
    // routes by a regex, and a marketing route named similarly enough to match
    // it would be published and then hidden.
    const headers = JSON.parse(vercel).headers as {
      source: string;
      headers: { key: string; value: string }[];
    }[];
    const noindex = headers.filter((entry) =>
      entry.headers.some((header) => header.key === 'X-Robots-Tag'),
    );
    noindex.forEach((entry) => {
      const pattern = new RegExp(`^${entry.source}$`);
      expect(pattern.test(route.path), `${entry.source} matches ${route.path}`).toBe(false);
    });
  });

  it('gives every marketing route a title and description of its own', () => {
    const titles = MARKETING_ROUTES.map((route) => route.title);
    const descriptions = MARKETING_ROUTES.map((route) => route.description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    MARKETING_ROUTES.forEach((route) => {
      // Google truncates a title past roughly 60 characters and a description
      // past roughly 160.
      expect(route.title.length, `${route.path} title`).toBeLessThanOrEqual(60);
      expect(route.description.length, `${route.path} description`).toBeLessThanOrEqual(165);
    });
  });

  it('keeps the two documents apart', () => {
    // index.html is what the pre-renderer writes the marketing page into, so it
    // must arrive empty; app.html is the shell for routes that render from
    // scratch, so it must carry no marketing markup or metadata.
    expect(read('index.html')).toMatch(/<div id="root"><\/div>/);
    const app = read('app.html');
    expect(app).toMatch(/<div id="root"><\/div>/);
    expect(app).not.toMatch(/og:title|canonical|application\/ld\+json/);
  });

  it('gives both documents the same theme script, which the CSP allows by hash', () => {
    // One CSP hash covers both files. A copy that drifts is silently blocked on
    // that page alone, and the only symptom is a flash of the wrong theme.
    const scriptOf = (file: string) => read(file).match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(scriptOf('app.html')).toBe(scriptOf('index.html'));
  });

  it('ships a static 404 page for Vercel to serve', () => {
    const notFound = read('public/404.html');
    expect(notFound).toContain('Error 404');
    // No bundle and no inline script: it is what renders when routing has
    // already failed, and the CSP forbids unhashed inline scripts anyway.
    expect(notFound).not.toMatch(/<script/);
  });
});
