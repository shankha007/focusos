// Runs under Node, but lives in the app's tsconfig, which deliberately leaves
// Node's types out so app code cannot reach for them.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Vercel answers every static file with `Access-Control-Allow-Origin: *`
 * unless told otherwise, which lets any site read any response from this one
 * with fetch(). Nothing here is secret today, but nothing needs cross-origin
 * reads either — the app, its worker and its manifest are all same-origin, and
 * crawlers fetching the share image do not use CORS. vercel.json cannot remove
 * a header, so it names this origin instead, and no other origin qualifies.
 */

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

const rules = (JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers: HeaderRule[] }).headers;

describe('Access-Control-Allow-Origin', () => {
  it('names the site itself on every route, replacing the platform wildcard', () => {
    const catchAll = rules.find((rule) => rule.source === '/(.*)');
    const header = catchAll?.headers.find((h) => h.key === 'Access-Control-Allow-Origin');
    expect(header?.value).toBe('https://focusos.pro');
  });

  it('is never opened back up to every origin by a narrower rule', () => {
    const wildcards = rules.flatMap((rule) =>
      rule.headers
        .filter((h) => h.key.toLowerCase() === 'access-control-allow-origin' && h.value.trim() === '*')
        .map(() => rule.source),
    );
    expect(wildcards).toEqual([]);
  });
});
