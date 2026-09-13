import { describe, expect, it, vi, type Mock } from 'vitest';
import { AmbientEngine, chimePeak } from '../audio';

/** An engine wired to a context the test holds, so every node it builds is observable. */
function engineWith(ctx: AudioContext) {
  const engine = new AmbientEngine();
  (engine as unknown as { ctx: AudioContext | null }).ctx = ctx;
  (engine as unknown as { master: GainNode | null }).master = ctx.createGain();
  return engine;
}

describe('chimePeak', () => {
  it('plays exactly as loud as it always has at the default volume', () => {
    expect(chimePeak(0.4)).toBeCloseTo(0.18);
  });

  it('follows the volume setting down', () => {
    // Ambience at a whisper used to end every session with a full-level tone.
    expect(chimePeak(0.1)).toBeCloseTo(0.045);
    expect(chimePeak(0.2)).toBeLessThan(chimePeak(0.4));
  });

  it('is silent at zero', () => {
    expect(chimePeak(0)).toBe(0);
  });

  it('never becomes a jolt at the top of the slider', () => {
    expect(chimePeak(1)).toBeLessThanOrEqual(0.3);
  });

  it('treats a volume outside 0–1 as the nearest end of the range', () => {
    expect(chimePeak(-2)).toBe(0);
    expect(chimePeak(9)).toBe(chimePeak(1));
  });
});

describe('AmbientEngine — the chime', () => {
  it('peaks at the level for the volume it is given', async () => {
    const ctx = new AudioContext();
    // Built before the spy, so the engine's own master gain is not counted as a note.
    const engine = engineWith(ctx);
    const gains: { gain: { linearRampToValueAtTime: Mock } }[] = [];
    const createGain = ctx.createGain.bind(ctx);
    vi.spyOn(ctx, 'createGain').mockImplementation(() => {
      const node = createGain();
      gains.push(node as unknown as { gain: { linearRampToValueAtTime: Mock } });
      return node;
    });

    await engine.chime('complete', 0.1);

    const peaks = gains.map((g) => g.gain.linearRampToValueAtTime.mock.calls[0]?.[0] as number);
    expect(peaks).toHaveLength(3); // one per note
    for (const peak of peaks) expect(peak).toBeCloseTo(chimePeak(0.1));
  });

  it('builds nothing at all when the volume is zero', async () => {
    const ctx = new AudioContext();
    const oscillators = vi.spyOn(ctx, 'createOscillator');

    await engineWith(ctx).chime('complete', 0);

    expect(oscillators).not.toHaveBeenCalled();
  });
});

describe('AmbientEngine — when the browser will not play sound', () => {
  it('resolves instead of rejecting when the autoplay policy refuses to resume', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = new AudioContext();
    (ctx as unknown as { state: string }).state = 'suspended';
    vi.spyOn(ctx, 'resume').mockRejectedValue(new DOMException('blocked', 'NotAllowedError'));
    const engine = engineWith(ctx);

    // Every caller fires these with `void`. A rejection used to go nowhere but
    // the console, with no hint as to why a session had ended silently.
    await expect(engine.play('rain', 0.5)).resolves.toBeUndefined();
    await expect(engine.chime('complete', 0.5)).resolves.toBeUndefined();

    // Noted once, not once per attempt.
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('resolves when the browser has no Web Audio at all', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const engine = new AmbientEngine();
    const original = window.AudioContext;
    // Simulate a browser without the API: constructing the context throws.
    (window as unknown as { AudioContext: unknown }).AudioContext = undefined;
    try {
      await expect(engine.chime('complete', 0.5)).resolves.toBeUndefined();
    } finally {
      (window as unknown as { AudioContext: unknown }).AudioContext = original;
    }
  });
});
