// Runs under Node, but lives in the app's tsconfig, which deliberately leaves
// Node's types out so app code cannot reach for them.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * security.txt (RFC 9116) tells anyone who finds a vulnerability where to
 * report it. The RFC makes Contact and Expires mandatory, and a file past its
 * Expires date is to be treated as stale — so the date is the part most
 * likely to rot. The last test fails a month ahead of it, while there is still
 * time to renew rather than after researchers have started ignoring the file.
 */

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const YEAR_MS = 366 * 24 * 60 * 60 * 1000;

const text = readFileSync('public/.well-known/security.txt', 'utf8');

/** Values for a field name, case-insensitively, as the RFC reads them. */
function field(name: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Za-z-]+):\s*(.+)$/))
    .filter((m): m is RegExpMatchArray => m !== null && m[1].toLowerCase() === name.toLowerCase())
    .map((m) => m[2].trim());
}

describe('security.txt', () => {
  it('names at least one contact as a mailto: or https: URI', () => {
    const contacts = field('Contact');
    expect(contacts.length).toBeGreaterThan(0);
    for (const contact of contacts) expect(contact).toMatch(/^(mailto:\S+@\S+|https:\/\/\S+)$/);
  });

  it('has exactly one Expires, as an ISO 8601 timestamp', () => {
    const expires = field('Expires');
    expect(expires).toHaveLength(1);
    expect(expires[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
  });

  it('points Canonical at the URL it is served from', () => {
    expect(field('Canonical')).toEqual(['https://focusos.pro/.well-known/security.txt']);
  });

  it('is not expired, nor due within a month — renew it by moving Expires forward', () => {
    const expires = Date.parse(field('Expires')[0]);
    const now = Date.now();
    expect(expires - now, 'security.txt expires within 30 days: set Expires up to a year ahead').toBeGreaterThan(MONTH_MS);
    // The RFC recommends less than a year, so a stale file cannot claim to be current for long.
    expect(expires - now).toBeLessThanOrEqual(YEAR_MS);
  });
});
