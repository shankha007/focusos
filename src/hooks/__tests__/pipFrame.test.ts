import { describe, expect, it } from 'vitest';
import { pipFrame, pipFrameKey } from '../usePictureInPicture';
import { createTimerState, pause, start } from '@/engine/timerEngine';
import { MINUTE } from '@/lib/utils';

const T0 = 1_700_000_000_000;
/** A 25-minute focus session, ten minutes in at T0. */
const running = start(createTimerState('focus', 25 * MINUTE), T0 - 10 * MINUTE);

describe('pipFrame', () => {
  it('shows the countdown, progress and task for a focus session', () => {
    const frame = pipFrame(running, 'Write the quarterly report for the board', T0);
    expect(frame.clock).toBe('15:00');
    expect(frame.progress).toBeCloseTo(0.4);
    expect(frame.isFocus).toBe(true);
    // Trimmed to fit the floating window.
    expect(frame.label).toBe('Write the quarterly repo');
  });

  it('says Paused while paused, and Break during a break', () => {
    expect(pipFrame(pause(running, T0), 'Anything', T0).label).toBe('Paused');
    const aBreak = start(createTimerState('short-break', 5 * MINUTE), T0);
    expect(pipFrame(aBreak, 'Anything', T0).label).toBe('Break');
  });

  it('keeps progress within the ring even past the end', () => {
    const overrun = start(createTimerState('focus', 25 * MINUTE), T0 - 40 * MINUTE);
    expect(pipFrame(overrun, null, T0).progress).toBe(1);
  });
});

describe('pipFrameKey', () => {
  it('stays the same while nothing visible changes', () => {
    // 200 ms and 400 ms into the same displayed second.
    const a = pipFrameKey(pipFrame(running, null, T0 + 200));
    const b = pipFrameKey(pipFrame(running, null, T0 + 400));
    // The loop this replaces redrew the whole canvas sixty times a second
    // regardless; now these two moments are recognised as the same frame.
    expect(a).toBe(b);
  });

  it('changes when the displayed second changes', () => {
    const before = pipFrameKey(pipFrame(running, null, T0 + 400));
    const after = pipFrameKey(pipFrame(running, null, T0 + 900));
    expect(before).not.toBe(after);
  });

  it('changes when the session is paused, even though the clock has not moved', () => {
    const live = pipFrameKey(pipFrame(running, null, T0));
    const paused = pipFrameKey(pipFrame(pause(running, T0), null, T0));
    expect(live).not.toBe(paused);
  });
});
