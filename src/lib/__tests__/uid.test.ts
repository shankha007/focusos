import { afterEach, describe, expect, it } from 'vitest';
import { uid } from '../utils';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Hides `randomUUID` the way a non-secure context does, leaving `getRandomValues` in place. */
function withoutRandomUUID() {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

describe('uid', () => {
  afterEach(() => {
    // Remove the shadowing property so the real method shows through again.
    delete (globalThis.crypto as unknown as { randomUUID?: unknown }).randomUUID;
  });

  it('produces a version-4 UUID where randomUUID exists', () => {
    expect(uid()).toMatch(V4);
  });

  it('still produces one over plain HTTP, where randomUUID does not', () => {
    withoutRandomUUID();
    expect(typeof crypto.randomUUID).not.toBe('function');

    // The first task or session created used to throw here.
    expect(() => uid()).not.toThrow();
    expect(uid()).toMatch(V4);
  });

  it('does not repeat itself in the fallback', () => {
    withoutRandomUUID();
    const ids = new Set(Array.from({ length: 2000 }, () => uid()));
    expect(ids.size).toBe(2000);
  });
});
