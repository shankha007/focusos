import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The Content-Security-Policy names the two inline scripts in index.html by
 * hash, which is what lets `script-src` stay at 'self' rather than opening up
 * to 'unsafe-inline'.
 *
 * A hash goes stale the moment either script is edited — even by a character —
 * and the failure is quiet: the browser blocks the script and the page carries
 * on without it. The theme would flash dark before settling, and the no-JS
 * fallback would never reveal itself. Neither is loud enough to notice in
 * review, so the check belongs here.
 */

// Vitest runs from the project root, so these resolve against it.
//
// Line endings are normalised before anything is hashed. A Windows checkout
// carries CRLF and a Linux one LF, which are different bytes and so a different
// digest — hashes computed on one would silently block the script on the other.
// The deployed build is produced on Linux, so LF is the form that is served.
const asServed = (text: string) => text.split('\r\n').join('\n');

const html = asServed(readFileSync('index.html', 'utf8'));
const vercel = readFileSync('vercel.json', 'utf8');

/** The inline scripts a browser will actually execute — JSON-LD is data, not code. */
function executableInlineScripts(source: string): string[] {
  const pattern =
    /<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g;
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

const csp = (
  JSON.parse(vercel) as {
    headers: { headers: { key: string; value: string }[] }[];
  }
).headers
  .flatMap((entry) => entry.headers)
  .find((header) => header.key === 'Content-Security-Policy')?.value;

describe('Content-Security-Policy', () => {
  it('is served on every route', () => {
    expect(csp).toBeDefined();
  });

  it('names every inline script in index.html by hash', () => {
    const scripts = executableInlineScripts(html);
    expect(scripts.length).toBeGreaterThan(0);

    for (const script of scripts) {
      const hash = `sha256-${createHash('sha256').update(script, 'utf8').digest('base64')}`;
      expect(
        csp,
        `An inline script in index.html is not covered by the CSP. Add '${hash}' to script-src.`,
      ).toContain(hash);
    }
  });

  it('does not fall back to unsafe-inline for scripts', () => {
    const scriptSrc = csp?.split(';').find((directive) => directive.trim().startsWith('script-src'));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain('unsafe-inline');
    expect(scriptSrc).not.toContain('unsafe-eval');
  });

  it('keeps the directives that matter for an app holding everything locally', () => {
    // The realistic threat is not defacement, it is a script exfiltrating a
    // user's entire logged history. connect-src is what stops that.
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'none'");
  });
});
