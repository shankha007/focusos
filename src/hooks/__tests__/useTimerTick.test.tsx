import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimerTick } from '../useTimerTick';
import { useTimerStore } from '@/store/useTimerStore';
import { useStatsStore } from '@/store/useStatsStore';
import { createTimerState, pause, start } from '@/engine/timerEngine';
import { MINUTE } from '@/lib/utils';

function Harness() {
  useTimerTick();
  return null;
}

const idle = createTimerState('focus', 25 * MINUTE);

describe('useTimerTick', () => {
  beforeEach(() => {
    // jsdom may not provide animation frames; the running case needs them.
    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), 16);
      window.cancelAnimationFrame = (id) => window.clearTimeout(id);
    }
  });

  afterEach(() => {
    useTimerStore.setState({ timer: idle });
  });

  it('sets no interval at all while the timer is idle', () => {
    useTimerStore.setState({ timer: idle });
    const setInterval = vi.spyOn(window, 'setInterval');

    const { unmount } = render(<Harness />);

    // The title interval used to wake every second for as long as the tab was
    // open, rewriting a title that could not have changed.
    expect(setInterval).not.toHaveBeenCalled();
    unmount();
  });

  it('writes a paused countdown once, rather than every second', () => {
    useTimerStore.setState({ timer: pause(start(idle, Date.now() - 5 * MINUTE)) });
    const setInterval = vi.spyOn(window, 'setInterval');

    const { unmount } = render(<Harness />);

    expect(document.title).toMatch(/^20:00 · Focus \(paused\)/);
    expect(setInterval).not.toHaveBeenCalled();
    unmount();
  });

  it('keeps the title counting while a session runs', () => {
    useTimerStore.setState({ timer: start(idle, Date.now() - MINUTE) });
    const setInterval = vi.spyOn(window, 'setInterval');

    const { unmount } = render(<Harness />);

    expect(document.title).toMatch(/· Focus — FocusOS$/);
    expect(setInterval).toHaveBeenCalled();
    unmount();
  });

  it('no longer reloads history when the timer goes idle', () => {
    useTimerStore.setState({ timer: start(idle, Date.now() - MINUTE) });
    const refresh = vi.spyOn(useStatsStore.getState(), 'refresh');

    const { rerender, unmount } = render(<Harness />);
    useTimerStore.setState({ timer: idle });
    rerender(<Harness />);

    // complete() applies the change it made; this was a second full read of
    // every session and distraction on every session end and every reset.
    expect(refresh).not.toHaveBeenCalled();
    unmount();
  });
});
