import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimerStore } from '../useTimerStore';
import { useSettingsStore } from '../useSettingsStore';
import { bootStores, resetApp } from '@/test/helpers';

describe('useTimerStore — when the browser refuses to store anything', () => {
  beforeEach(async () => {
    await resetApp();
    await bootStores();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the timer running when the session cannot be saved', async () => {
    // What Safari's private browsing and a full quota both do.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('exceeded the quota', 'QuotaExceededError');
    });

    // Every one of these calls `persist`. An unhandled throw did not merely skip
    // the save — it came back out of the action, and the timer stopped working.
    await expect(useTimerStore.getState().startSession('focus')).resolves.toBeUndefined();
    expect(useTimerStore.getState().timer.status).toBe('running');

    expect(() => useTimerStore.getState().pause()).not.toThrow();
    expect(useTimerStore.getState().timer.status).toBe('paused');

    expect(() => useTimerStore.getState().resume()).not.toThrow();
    expect(() => useTimerStore.getState().setTask('task_x', 'Something')).not.toThrow();
    expect(() => useTimerStore.getState().setMood(4, 3)).not.toThrow();
    expect(() => useTimerStore.getState().reset()).not.toThrow();

    expect(useTimerStore.getState().timer.status).toBe('idle');
  });

  it('starts fresh when the stored session cannot be read back', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('access denied', 'SecurityError');
    });

    expect(() => useTimerStore.getState().hydrate()).not.toThrow();
    expect(useTimerStore.getState().hydrated).toBe(true);
    expect(useTimerStore.getState().timer.status).toBe('idle');
  });

  it('ignores a stored session that is not valid JSON', () => {
    localStorage.setItem('focusos:timer', '{ this is not json');

    expect(() => useTimerStore.getState().hydrate()).not.toThrow();
    expect(useTimerStore.getState().timer.status).toBe('idle');
  });
});

describe('useSettingsStore — reduce motion', () => {
  /** Points `matchMedia` at a given answer for the reduce-motion query. */
  function systemAsks(reduce: boolean) {
    const listeners: ((e: { matches: boolean }) => void)[] = [];
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
      const isMotion = query.includes('prefers-reduced-motion');
      return {
        matches: isMotion ? reduce : false,
        media: query,
        onchange: null,
        addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
          if (isMotion) listeners.push(fn);
        },
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: () => false,
      } as unknown as MediaQueryList;
    });
    return { change: (matches: boolean) => listeners.forEach((fn) => fn({ matches })) };
  }

  beforeEach(async () => {
    await resetApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reduces motion when the OS asks, even with the app's own switch off", async () => {
    systemAsks(true);
    await useSettingsStore.getState().load();

    // The Settings screen has always claimed this. Until now only the CSS half
    // was true, and every Framer Motion animation ignored it.
    expect(useSettingsStore.getState().settings.reducedMotion).toBe(false);
    expect(useSettingsStore.getState().reducedMotion).toBe(true);
    expect(document.documentElement.dataset.motion).toBe('reduced');
  });

  it('reduces motion when the app switch is on and the OS is not asking', async () => {
    systemAsks(false);
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().reducedMotion).toBe(false);

    await useSettingsStore.getState().update({ reducedMotion: true });
    expect(useSettingsStore.getState().reducedMotion).toBe(true);
    expect(document.documentElement.dataset.motion).toBe('reduced');
  });

  it('follows the OS when it changes mid-session', async () => {
    const media = systemAsks(false);
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().reducedMotion).toBe(false);

    media.change(true);
    expect(useSettingsStore.getState().reducedMotion).toBe(true);
    expect(document.documentElement.dataset.motion).toBe('reduced');

    media.change(false);
    expect(useSettingsStore.getState().reducedMotion).toBe(false);
  });

  it('will not let the app switch overrule the OS', async () => {
    systemAsks(true);
    await useSettingsStore.getState().load();

    // The switch is disabled in the UI for exactly this reason; the store has to
    // agree, or the two would disagree about what is actually happening.
    await useSettingsStore.getState().update({ reducedMotion: false });
    expect(useSettingsStore.getState().reducedMotion).toBe(true);
  });
});
