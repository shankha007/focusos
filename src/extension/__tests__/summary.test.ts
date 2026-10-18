import { describe, expect, it } from 'vitest';
import { createTimerState, pause, start } from '@/engine/timerEngine';
import { isFocusRequest, readCommand, sameSummary, summarize } from '../summary';

const MIN = 60_000;

describe('summarize', () => {
  it('gives a running session a wall-clock end', () => {
    const timer = start(createTimerState('focus', 25 * MIN), 1_000);
    const summary = summarize(timer, 'Write report', 1_000 + 5 * MIN);
    expect(summary).toMatchObject({
      status: 'running',
      type: 'focus',
      endsAt: 1_000 + 25 * MIN,
      remainingMs: 20 * MIN,
      taskTitle: 'Write report',
    });
  });

  it('gives a paused session time left and no end', () => {
    const running = start(createTimerState('focus', 25 * MIN), 0);
    const paused = pause(running, 10 * MIN);
    // Paused time does not count down.
    const summary = summarize(paused, null, 15 * MIN);
    expect(summary.endsAt).toBeNull();
    expect(summary.remainingMs).toBe(15 * MIN);
  });

  it('gives an idle timer its full length', () => {
    const summary = summarize(createTimerState('short-break', 5 * MIN), null, 0);
    expect(summary).toMatchObject({ status: 'idle', endsAt: null, remainingMs: 5 * MIN });
  });
});

describe('sameSummary', () => {
  const timer = start(createTimerState('focus', 25 * MIN), 0);

  it('treats the per-second repaint of a running session as no change', () => {
    expect(sameSummary(summarize(timer, null, 1_000), summarize(timer, null, 2_003))).toBe(true);
  });

  it('notices a pause', () => {
    const before = summarize(timer, null, MIN);
    const after = summarize(pause(timer, MIN), null, MIN);
    expect(sameSummary(before, after)).toBe(false);
  });

  it('notices a new task', () => {
    expect(sameSummary(summarize(timer, 'A', 0), summarize(timer, 'B', 0))).toBe(false);
  });

  it('always writes the first summary', () => {
    expect(sameSummary(null, summarize(timer, null, 0))).toBe(false);
  });
});

describe('messages', () => {
  it('reads only our own commands', () => {
    expect(readCommand({ type: 'focusos:command', command: 'toggle' })).toBe('toggle');
    expect(readCommand({ type: 'focusos:command', command: 'reset' })).toBeNull();
    expect(readCommand({ type: 'other', command: 'start' })).toBeNull();
    expect(readCommand('start')).toBeNull();
    expect(readCommand(null)).toBeNull();
  });

  it('recognises a request to bring the app to the front', () => {
    expect(isFocusRequest({ type: 'focusos:focus' })).toBe(true);
    expect(isFocusRequest({ type: 'focusos:command' })).toBe(false);
  });
});
