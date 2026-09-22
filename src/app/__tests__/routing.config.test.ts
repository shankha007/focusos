import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

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

/** Every `path="/x"` in App.tsx except "/" and the "*" fallback. */
function appRoutes(): string[] {
  const source = read('src/app/App.tsx');
  return [...source.matchAll(/<Route path="\/([a-z-]+)"/g)].map((match) => match[1]);
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

  it.each(routes)('rewrites /%s to the app shell', (route) => {
    const rewrites = JSON.parse(vercel).rewrites as { source: string; destination: string }[];
    const matching = rewrites.filter((rule) => rule.source.includes(route));
    expect(matching.length).toBeGreaterThan(0);
    matching.forEach((rule) => expect(rule.destination).toBe('/index.html'));
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

  it('has no catch-all rewrite, so an unknown path can 404', () => {
    const rewrites = JSON.parse(vercel).rewrites as { source: string }[];
    expect(rewrites.some((rule) => rule.source === '/(.*)')).toBe(false);
  });

  it('does not disallow the app routes in robots.txt', () => {
    // Disallow would stop a crawler ever reading the noindex header above,
    // which is what actually keeps these pages out of the index.
    expect(robots).not.toMatch(/^Disallow: \/\w/m);
  });

  it('ships a static 404 page for Vercel to serve', () => {
    const notFound = read('public/404.html');
    expect(notFound).toContain('Error 404');
    // No bundle and no inline script: it is what renders when routing has
    // already failed, and the CSP forbids unhashed inline scripts anyway.
    expect(notFound).not.toMatch(/<script/);
  });
});
