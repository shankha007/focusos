import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppUpdate } from '../useAppUpdate';
import { useTimerStore } from '@/store/useTimerStore';
import { createTimerState } from '@/engine/timerEngine';
import { MINUTE } from '@/lib/utils';

/** The service worker layer, stood in for so a test can decide when an update arrives. */
const pwa = vi.hoisted(() => ({
  applyUpdate: vi.fn(() => Promise.resolve()),
  isUpdateWaiting: vi.fn(() => false),
  onUpdateWaiting: vi.fn<(listener: () => void) => () => void>(() => () => {}),
}));
vi.mock('@/lib/pwa', () => pwa);

const toast = vi.hoisted(() =>
  Object.assign(
    vi.fn((_message: string, _options?: Record<string, unknown>) => 'toast-id'),
    { dismiss: vi.fn() },
  ),
);
vi.mock('sonner', () => ({ toast }));

function Harness() {
  useAppUpdate();
  return null;
}

/** Puts the timer into a running focus session, or leaves it idle. */
function setTimer(status: 'idle' | 'running') {
  useTimerStore.setState({
    timer: { ...createTimerState('focus', 25 * MINUTE), status, startedAt: status === 'running' ? Date.now() : null },
  });
}

describe('useAppUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pwa.isUpdateWaiting.mockReturnValue(false);
    pwa.onUpdateWaiting.mockImplementation(() => () => {});
    setTimer('idle');
  });

  afterEach(() => {
    setTimer('idle');
  });

  it('does nothing while no new build is waiting', () => {
    render(<Harness />);
    expect(pwa.applyUpdate).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('takes the update straight away when nothing is running', () => {
    pwa.isUpdateWaiting.mockReturnValue(true);
    render(<Harness />);

    // There is no session to interrupt, and staying a version behind helps nobody.
    expect(pwa.applyUpdate).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
  });

  it('offers the update instead of taking it while a session is in flight', () => {
    pwa.isUpdateWaiting.mockReturnValue(true);
    setTimer('running');
    render(<Harness />);

    // The bug this replaces: the page reloaded on its own, taking the ambient
    // soundscape and the floating timer with it, mid-session and unannounced.
    expect(pwa.applyUpdate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledOnce();
    expect(toast.mock.calls[0][0]).toBe('A new version is ready');
  });

  it('takes it once the session ends, without being asked again', () => {
    pwa.isUpdateWaiting.mockReturnValue(true);
    setTimer('running');
    render(<Harness />);
    expect(pwa.applyUpdate).not.toHaveBeenCalled();

    // Outside React's knowledge, so the re-render has to be flushed.
    act(() => setTimer('idle'));

    expect(toast.dismiss).toHaveBeenCalledWith('toast-id');
    expect(pwa.applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('reacts to an update that arrives while the page is open', () => {
    let notify = () => {};
    pwa.onUpdateWaiting.mockImplementation((listener) => {
      notify = listener;
      return () => {};
    });
    render(<Harness />);
    expect(pwa.applyUpdate).not.toHaveBeenCalled();

    // What a deploy looks like to a tab that was already open.
    act(() => notify());

    expect(pwa.applyUpdate).toHaveBeenCalledTimes(1);
  });
});
