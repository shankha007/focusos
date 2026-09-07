import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AmbientEngine } from '../audio';

/**
 * The stub in the test setup answers every Web Audio call, so what these check
 * is the shape of the graph the engine builds rather than any sound.
 */
function countBufferAllocations() {
  const ctx = new AudioContext();
  const spy = vi.spyOn(ctx, 'createBuffer');
  // The engine builds its own context; hand it this one so the calls are visible.
  const engine = new AmbientEngine();
  (engine as unknown as { ctx: AudioContext | null }).ctx = ctx;
  (engine as unknown as { master: GainNode | null }).master = ctx.createGain();
  return { engine, spy };
}

describe('AmbientEngine — noise buffers', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('generates each flavour of noise once, however many voices need it', async () => {
    const { engine, spy } = countBufferAllocations();

    // Rain is the worst case: two steady layers plus a burst layer that fires
    // every 50–400 ms, each of which used to allocate its own two-second buffer.
    await engine.play('rain', 0.5);
    const afterFirstBuild = spy.mock.calls.length;

    // At most one buffer per flavour — rain uses white and pink.
    expect(afterFirstBuild).toBeLessThanOrEqual(2);

    // Switching away and back must not regenerate them either.
    await engine.play('fireplace', 0.5);
    await engine.play('rain', 0.5);
    const flavoursUsed = new Set(['white', 'pink', 'brown']);
    expect(spy.mock.calls.length).toBeLessThanOrEqual(flavoursUsed.size);

    engine.stop();
  });

  it('starts each voice at its own offset so a shared buffer does not repeat', async () => {
    const ctx = new AudioContext();
    const offsets: number[] = [];
    const original = ctx.createBufferSource.bind(ctx);
    vi.spyOn(ctx, 'createBufferSource').mockImplementation(() => {
      const node = original();
      const start = node.start.bind(node);
      node.start = (when?: number, offset?: number) => {
        offsets.push(offset ?? 0);
        return start(when, offset);
      };
      return node;
    });

    const engine = new AmbientEngine();
    (engine as unknown as { ctx: AudioContext | null }).ctx = ctx;
    (engine as unknown as { master: GainNode | null }).master = ctx.createGain();
    await engine.play('rain', 0.5);

    expect(offsets.length).toBeGreaterThan(0);
    // Every offset lands inside the buffer, and they are not all the same —
    // identical offsets would play the same 80 ms of noise on every drop.
    expect(offsets.every((o) => o >= 0 && o < 2)).toBe(true);
    expect(new Set(offsets).size).toBeGreaterThan(1);

    engine.stop();
  });
});
