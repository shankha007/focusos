import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stopFollowingSystem, useSettingsStore } from '../useSettingsStore';
import { resetApp } from '@/test/helpers';

/** A matchMedia whose every list shares one pair of spies, so registrations can be counted. */
function countingMatchMedia() {
  const added = vi.fn();
  const removed = vi.fn();
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: added,
        removeEventListener: removed,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: () => false,
      }),
  );
  return { added, removed };
}

describe('useSettingsStore — following the OS', () => {
  beforeEach(async () => {
    await resetApp();
  });

  it('attaches its listeners once, however many times settings load', async () => {
    const { added } = countingMatchMedia();

    // Boot, then two restores — each of which reloads settings.
    await useSettingsStore.getState().load();
    await useSettingsStore.getState().load();
    await useSettingsStore.getState().load();

    // One for colour scheme, one for reduced motion. It used to be six, and
    // every OS appearance change repainted once per load.
    expect(added).toHaveBeenCalledTimes(2);
  });

  it('detaches them on teardown, so the next load attaches afresh', async () => {
    const { added, removed } = countingMatchMedia();

    await useSettingsStore.getState().load();
    stopFollowingSystem();
    expect(removed).toHaveBeenCalledTimes(2);

    await useSettingsStore.getState().load();
    expect(added).toHaveBeenCalledTimes(4);
  });

  it('is safe to tear down when nothing is attached', () => {
    stopFollowingSystem();
    expect(() => stopFollowingSystem()).not.toThrow();
  });
});
