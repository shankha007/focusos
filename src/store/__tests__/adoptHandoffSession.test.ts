import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { parkSession, readParkedSession } from '@/features/landing/handoff';
import { useSettingsStore } from '@/store/useSettingsStore';
import { adoptHandoffSession } from '@/store/adoptHandoffSession';
import { resetApp } from '@/test/helpers';

/**
 * The workspace adopts whatever the landing page finished. Someone's first
 * twenty-five minutes counting toward their history is the whole point of the
 * handoff, and a duplicate of it is worse than losing it — history is what the
 * analytics and the adaptive engine reason about.
 */

const MINUTE = 60_000;

beforeEach(async () => {
  await resetApp();
});

describe('adoptHandoffSession', () => {
  it('writes the parked session to history and awards its XP', async () => {
    const startedAt = Date.now() - 25 * MINUTE;
    parkSession({
      startedAt,
      endedAt: startedAt + 25 * MINUTE,
      plannedMs: 25 * MINUTE,
      actualMs: 25 * MINUTE,
    });
    const xpBefore = useSettingsStore.getState().settings.xp;

    await adoptHandoffSession();

    const sessions = await db.sessions.toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      type: 'focus',
      completed: true,
      plannedMs: 25 * MINUTE,
      actualMs: 25 * MINUTE,
      startedAt,
      distractionCount: 0,
    });
    expect(useSettingsStore.getState().settings.xp).toBeGreaterThan(xpBefore);
  });

  it('adopts a session only once', async () => {
    const startedAt = Date.now() - 25 * MINUTE;
    parkSession({
      startedAt,
      endedAt: startedAt + 25 * MINUTE,
      plannedMs: 25 * MINUTE,
      actualMs: 25 * MINUTE,
    });

    await adoptHandoffSession();
    // Every subsequent boot runs this again.
    await adoptHandoffSession();
    await adoptHandoffSession();

    expect(await db.sessions.count()).toBe(1);
    expect(readParkedSession()).toBeNull();
  });

  it('does nothing when no session is waiting', async () => {
    await adoptHandoffSession();
    expect(await db.sessions.count()).toBe(0);
  });

  it('ignores a malformed record rather than writing a broken session', async () => {
    localStorage.setItem('focusos:handoff-session', '{"startedAt":"yesterday"}');

    await adoptHandoffSession();

    expect(await db.sessions.count()).toBe(0);
  });

  it('ignores a record whose clock runs backwards', async () => {
    const startedAt = Date.now();
    localStorage.setItem(
      'focusos:handoff-session',
      JSON.stringify({
        startedAt,
        endedAt: startedAt - MINUTE,
        plannedMs: 25 * MINUTE,
        actualMs: 25 * MINUTE,
      }),
    );

    await adoptHandoffSession();

    // A session that ended before it began cannot be placed on a day, and the
    // analytics would carry it forever.
    expect(await db.sessions.count()).toBe(0);
  });
});
