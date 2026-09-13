import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock, type MockInstance } from 'vitest';
import { useTimerTick } from '../useTimerTick';
import { AmbientEngine, ambient, chimePeak } from '@/lib/audio';
import { useTimerStore } from '@/store/useTimerStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { DEFAULT_SETTINGS } from '@/db/schema';
import { createTimerState, start } from '@/engine/timerEngine';
import { MINUTE } from '@/lib/utils';
import { bootStores, resetApp } from '@/test/helpers';

function Harness() {
  useTimerTick();
  return null;
}

/** An engine wired to a context the test holds, so every node it builds is observable. */
function engineWith(ctx: AudioContext) {
  const engine = new AmbientEngine();
  (engine as unknown as { ctx: AudioContext | null }).ctx = ctx;
  (engine as unknown as { master: GainNode | null }).master = ctx.createGain();
  return engine;
}

describe('AmbientEngine — the tick', () => {
  it('is quieter than the chime, and follows the volume', () => {
    const ctx = new AudioContext();
    const engine = engineWith(ctx);
    const gains: { gain: { setValueAtTime: Mock } }[] = [];
    const createGain = ctx.createGain.bind(ctx);
    vi.spyOn(ctx, 'createGain').mockImplementation(() => {
      const node = createGain();
      gains.push(node as unknown as { gain: { setValueAtTime: Mock } });
      return node;
    });

    engine.tick(0.4);
    engine.tick(0.1);

    const [loud, quiet] = gains.map((g) => g.gain.setValueAtTime.mock.calls[0][0] as number);
    expect(loud).toBeLessThan(chimePeak(0.4));
    expect(quiet).toBeLessThan(loud);
  });

  it('never tries to resume a suspended context from a tick', () => {
    const ctx = new AudioContext();
    (ctx as unknown as { state: string }).state = 'suspended';
    const resume = vi.spyOn(ctx, 'resume');
    const oscillators = vi.spyOn(ctx, 'createOscillator');

    engineWith(ctx).tick(0.4);

    // Ticks come from an interval, not a gesture; a resume would be refused every second.
    expect(resume).not.toHaveBeenCalled();
    expect(oscillators).not.toHaveBeenCalled();
  });
});

describe('useTimerTick — the ticking clock', () => {
  let tick: MockInstance<(volume?: number) => void>;

  beforeEach(() => {
    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), 16);
      window.cancelAnimationFrame = (id) => window.clearTimeout(id);
    }
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    tick = vi.spyOn(ambient, 'tick').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    useTimerStore.setState({ timer: createTimerState('focus', 25 * MINUTE) });
    useSettingsStore.setState({ settings: DEFAULT_SETTINGS });
  });

  const withSettings = (patch: Partial<typeof DEFAULT_SETTINGS>) =>
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS, ...patch } });

  it('ticks once a second during focus when switched on', () => {
    withSettings({ tickingEnabled: true, soundVolume: 0.5 });
    useTimerStore.setState({ timer: start(createTimerState('focus', 25 * MINUTE), Date.now() - MINUTE) });

    const { unmount } = render(<Harness />);
    vi.advanceTimersByTime(3000);

    // The setting was stored from the first version with nothing behind it.
    expect(tick).toHaveBeenCalledTimes(3);
    expect(tick).toHaveBeenCalledWith(0.5);
    unmount();
  });

  it('stays silent when switched off', () => {
    withSettings({ tickingEnabled: false });
    useTimerStore.setState({ timer: start(createTimerState('focus', 25 * MINUTE), Date.now() - MINUTE) });

    const { unmount } = render(<Harness />);
    vi.advanceTimersByTime(3000);

    expect(tick).not.toHaveBeenCalled();
    unmount();
  });

  it('does not tick through a break', () => {
    withSettings({ tickingEnabled: true });
    useTimerStore.setState({ timer: start(createTimerState('short-break', 5 * MINUTE), Date.now() - MINUTE) });

    const { unmount } = render(<Harness />);
    vi.advanceTimersByTime(3000);

    expect(tick).not.toHaveBeenCalled();
    unmount();
  });
});

describe('useTimerStore — unlocking audio for the tick', () => {
  beforeEach(async () => {
    await resetApp();
    await bootStores();
  });

  it('unlocks audio when a focus session starts with ticking on', async () => {
    const prime = vi.spyOn(ambient, 'prime').mockResolvedValue();
    await useSettingsStore.getState().update({ tickingEnabled: true });

    await useTimerStore.getState().startSession('focus');

    // Starting a session is a user gesture; the interval that plays ticks is not.
    expect(prime).toHaveBeenCalled();
  });

  it('leaves audio alone when ticking is off', async () => {
    const prime = vi.spyOn(ambient, 'prime').mockResolvedValue();

    await useTimerStore.getState().startSession('focus');

    expect(prime).not.toHaveBeenCalled();
  });
});
