import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, db, initDb } from '../schema';
import { MINUTE } from '@/lib/utils';
import { resetApp } from '@/test/helpers';

/**
 * A restore from before SETTING_LIMITS existed could already have written
 * values that crash the app. Validating new backups does nothing for those,
 * so opening the database repairs them.
 */
describe('initDb — settings already on disk', () => {
  beforeEach(async () => {
    await resetApp();
  });

  it('repairs limited settings a restore left out of range', async () => {
    await db.settings.put({
      ...DEFAULT_SETTINGS,
      dailyGlassGoal: 4_294_967_296,
      focusMs: 1e308,
      theme: 'forest',
    });

    const settings = await initDb();

    expect(settings.dailyGlassGoal).toBe(DEFAULT_SETTINGS.dailyGlassGoal);
    expect(settings.focusMs).toBe(DEFAULT_SETTINGS.focusMs);
    // Everything else is the user's and stays.
    expect(settings.theme).toBe('forest');
    expect((await db.settings.get('settings'))?.dailyGlassGoal).toBe(DEFAULT_SETTINGS.dailyGlassGoal);
  });

  it('leaves in-range settings exactly as they are', async () => {
    await db.settings.put({ ...DEFAULT_SETTINGS, focusMs: 50 * MINUTE, dailyGlassGoal: 12 });

    const settings = await initDb();

    expect(settings.focusMs).toBe(50 * MINUTE);
    expect(settings.dailyGlassGoal).toBe(12);
  });
});
