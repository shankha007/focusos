import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AmbientEngine, NOISE_SECONDS } from '../audio';

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

    // Rain is the worst case: several steady beds plus drops that fire every
    // few tens of milliseconds, each of which would otherwise allocate its own
    // buffer.
    await engine.play('rain', 0.5);
    const afterFirstBuild = spy.mock.calls.length;

    // At most one buffer per flavour — rain uses all three.
    expect(afterFirstBuild).toBeLessThanOrEqual(3);

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
    expect(offsets.every((o) => o >= 0 && o < NOISE_SECONDS)).toBe(true);
    expect(new Set(offsets).size).toBeGreaterThan(1);

    engine.stop();
  });
});

describe('AmbientEngine — switching soundscapes', () => {
  it('cuts everything from the previous sound off from the output at once', async () => {
    const ctx = new AudioContext();
    const engine = new AmbientEngine();
    const master = ctx.createGain();
    (engine as unknown as { ctx: AudioContext | null }).ctx = ctx;
    (engine as unknown as { master: GainNode | null }).master = master;

    type Stub = { connect: Mock; disconnect: Mock };
    const created: Stub[] = [];
    for (const method of ['createGain', 'createStereoPanner'] as const) {
      const original = ctx[method].bind(ctx) as () => AudioNode;
      vi.spyOn(ctx, method).mockImplementation((() => {
        const node = original();
        created.push(node as unknown as Stub);
        return node;
      }) as never);
    }

    // Waves schedule ten seconds ahead. If their bus stayed wired to the
    // output, the ocean would keep breaking over whatever was chosen next.
    await engine.play('ocean', 0.5);
    const wiredToOutput = created.filter((n) => n.connect.mock.calls.some(([to]) => to === master));
    expect(wiredToOutput.length).toBeGreaterThan(0);

    await engine.play('fireplace', 0.5);
    for (const node of wiredToOutput) expect(node.disconnect).toHaveBeenCalled();

    engine.stop();
  });
});
