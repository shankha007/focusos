import { beforeEach, describe, expect, it } from 'vitest';
import { db, MAX_GLASSES_PER_DAY } from '@/db/schema';
import { useHydrationStore } from '@/store/useHydrationStore';
import { dateKey } from '@/lib/utils';
import { resetApp } from '@/test/helpers';

/**
 * A backup restore refuses a day above MAX_GLASSES_PER_DAY, so logging must
 * stop there too — otherwise the app could write a count that its own export
 * would then fail to bring back.
 */
describe('logging water past the daily cap', () => {
  beforeEach(async () => {
    await resetApp();
  });

  it('counts up to the cap', async () => {
    await db.hydration.put({ date: dateKey(), glasses: MAX_GLASSES_PER_DAY - 1, lastAt: 1 });

    await useHydrationStore.getState().logGlass();

    expect((await db.hydration.get(dateKey()))?.glasses).toBe(MAX_GLASSES_PER_DAY);
    expect(useHydrationStore.getState().glasses).toBe(MAX_GLASSES_PER_DAY);
  });

  it('stops at the cap instead of counting past it', async () => {
    await db.hydration.put({ date: dateKey(), glasses: MAX_GLASSES_PER_DAY, lastAt: 1 });

    await useHydrationStore.getState().logGlass();
    await useHydrationStore.getState().logGlass();

    expect((await db.hydration.get(dateKey()))?.glasses).toBe(MAX_GLASSES_PER_DAY);
    expect(useHydrationStore.getState().glasses).toBe(MAX_GLASSES_PER_DAY);
  });

  it('still lets a glass be taken back at the cap', async () => {
    await db.hydration.put({ date: dateKey(), glasses: MAX_GLASSES_PER_DAY, lastAt: 1 });
    await useHydrationStore.getState().load();

    await useHydrationStore.getState().undoGlass();

    expect((await db.hydration.get(dateKey()))?.glasses).toBe(MAX_GLASSES_PER_DAY - 1);
  });
});
