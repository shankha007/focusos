import type { SoundId } from '@/types';

/**
 * Every soundscape is synthesized in the browser from filtered noise and
 * oscillators — no audio files ship with the app. That keeps the bundle tiny,
 * makes the sounds seamless (no loop points to hear), and means ambience works
 * offline on first load.
 */

export interface SoundMeta {
  id: SoundId;
  label: string;
  description: string;
  icon: string;
}

export const SOUNDS: SoundMeta[] = [
  { id: 'rain', label: 'Rain', description: 'Steady rainfall on a window', icon: 'CloudRain' },
  { id: 'forest', label: 'Forest', description: 'Wind through leaves, distant birds', icon: 'Trees' },
  { id: 'ocean', label: 'Ocean', description: 'Slow waves rolling in', icon: 'Waves' },
  { id: 'cafe', label: 'Coffee shop', description: 'Low murmur and clatter', icon: 'Coffee' },
  { id: 'white', label: 'White noise', description: 'Flat, even masking', icon: 'AudioLines' },
  { id: 'brown', label: 'Brown noise', description: 'Deep, warm low-end', icon: 'Activity' },
  { id: 'fireplace', label: 'Fireplace', description: 'Crackling logs', icon: 'Flame' },
  { id: 'wind', label: 'Wind', description: 'Open, sweeping gusts', icon: 'Wind' },
];

type NoiseType = 'white' | 'pink' | 'brown';

/** Seconds of noise held per flavour. Long enough that the loop point isn't audible. */
const NOISE_SECONDS = 2;

/**
 * One buffer per flavour, per context.
 *
 * Generating noise is not cheap: two seconds at 44.1 kHz is 88,200 samples,
 * 345 KB, and about a millisecond of the main thread. That was being paid on
 * every raindrop and every crackle of the fire — sounds that last 40 to 80 ms —
 * so rain alone churned roughly 1.5 MB a second to play the same texture over
 * and over, on the one screen meant to feel calm.
 *
 * A buffer is immutable once filled, and any number of sources can read from
 * the same one, so there is no reason to hold more than three.
 */
const noiseBuffers = new WeakMap<AudioContext, Map<NoiseType, AudioBuffer>>();

/** The shared buffer for one flavour of noise, generated on first use. */
function noiseBuffer(ctx: AudioContext, type: NoiseType): AudioBuffer {
  let byType = noiseBuffers.get(ctx);
  if (!byType) {
    byType = new Map();
    noiseBuffers.set(ctx, byType);
  }
  let buffer = byType.get(type);
  if (!buffer) {
    buffer = makeNoiseBuffer(ctx, type);
    byType.set(type, buffer);
  }
  return buffer;
}

/** Two seconds of noise, looped — long enough that the period isn't audible. */
function makeNoiseBuffer(ctx: AudioContext, type: NoiseType): AudioBuffer {
  const length = ctx.sampleRate * NOISE_SECONDS;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  } else if (type === 'brown') {
    let last = 0;
    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      data[i] = last * 3.5;
    }
  } else {
    // Paul Kellet's pink-noise approximation.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  return buffer;
}

/** The chime's peak gain at the default volume — the level it has always played at. */
const CHIME_PEAK = 0.18;

/** The volume setting's shipped default, which the chime is calibrated against. */
const DEFAULT_VOLUME = 0.4;

/** Loud enough to notice at full volume, without the end of a session arriving as a jolt. */
const CHIME_PEAK_MAX = 0.3;

/**
 * How loud the completion chime should peak for a given volume setting.
 *
 * The chime used to play at a fixed gain, so turning ambience down to a whisper
 * still ended every session with a full-level tone — in headphones, mid deep
 * focus, which is exactly where it lands hardest. It now follows the volume
 * setting, scaled so that the default sounds exactly as it always has, and
 * capped so the top of the slider cannot turn it into an alarm.
 */
export function chimePeak(volume: number): number {
  const level = Math.min(1, Math.max(0, volume));
  return Math.min(CHIME_PEAK_MAX, CHIME_PEAK * (level / DEFAULT_VOLUME));
}

/** One voice of a soundscape: the nodes it created, and the call that silences and disconnects them. */
interface Layer {
  nodes: AudioNode[];
  stop: () => void;
}

/** Owns the single AudioContext and whichever soundscape is currently playing, so switching sounds or adjusting volume never stacks up overlapping graphs. */
export class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private layers: Layer[] = [];
  private current: SoundId | null = null;
  private volume = DEFAULT_VOLUME;
  private warnedUnavailable = false;

  /** Lazily creates the AudioContext on first use — building one before a user gesture would start it suspended. */
  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  /** The soundscape currently playing, or null when silent. */
  get activeSound(): SoundId | null {
    return this.current;
  }

  /** Switches to soundscape `id`, replacing anything already playing and fading in. */
  async play(id: SoundId, volume = this.volume): Promise<void> {
    try {
      const ctx = this.ensureContext();
      if (ctx.state === 'suspended') await ctx.resume();

      this.stopLayers();
      this.current = id;
      this.volume = volume;

      const build = BUILDERS[id];
      this.layers = build(ctx, this.master!);

      // Fade in rather than snapping on — an abrupt start is jarring mid-focus.
      const now = ctx.currentTime;
      this.master!.gain.cancelScheduledValues(now);
      this.master!.gain.setValueAtTime(this.master!.gain.value, now);
      this.master!.gain.linearRampToValueAtTime(volume, now + 1.2);
    } catch (error) {
      this.noteUnavailable(error);
    }
  }

  /**
   * Records that sound could not be made, once.
   *
   * Every caller fires `play` and `chime` with `void`, so a rejection went
   * nowhere — an unhandled rejection in the console, and no clue why a session
   * ended silently. A context created without a user gesture starts suspended
   * and browsers enforcing autoplay rules refuse to resume it; a browser with no
   * Web Audio at all throws on construction. Neither is worth interrupting
   * anyone over, so both resolve quietly after one note.
   */
  private noteUnavailable(error: unknown): void {
    if (this.warnedUnavailable) return;
    this.warnedUnavailable = true;
    console.warn('FocusOS could not play sound — usually the browser waiting for a click first', error);
  }

  /** Changes the master volume with a short ramp, so the level never steps audibly. */
  setVolume(volume: number): void {
    this.volume = volume;
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(volume, now + 0.2);
  }

  /** Fades the ambience out and tears down its nodes once the fade has finished. */
  stop(): void {
    if (!this.ctx || !this.master) {
      this.current = null;
      return;
    }
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + 0.6);
    const layers = this.layers;
    this.layers = [];
    this.current = null;
    window.setTimeout(() => layers.forEach((l) => l.stop()), 700);
  }

  /** Immediately disposes every layer of the current graph, with no fade. */
  private stopLayers(): void {
    this.layers.forEach((l) => l.stop());
    this.layers = [];
  }

  /**
   * A short, soft chime for session transitions, at a level that follows the
   * volume setting — see `chimePeak`.
   *
   * It connects straight to the destination rather than through the master
   * gain, deliberately. The master is what ambience fades on, and `stop` ramps
   * it to zero at the very moment a session completes — routed through it, the
   * completion chime would be silenced by the completion.
   */
  async chime(kind: 'complete' | 'start' = 'complete', volume = this.volume): Promise<void> {
    const peak = chimePeak(volume);
    // Silent is silent: do not build a graph, or even a context, for nothing.
    if (peak <= 0) return;

    try {
      const ctx = this.ensureContext();
      if (ctx.state === 'suspended') await ctx.resume();

      const notes = kind === 'complete' ? [523.25, 659.25, 783.99] : [783.99, 523.25];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = ctx.currentTime + i * 0.14;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(peak, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.1);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 1.2);
      });
    } catch (error) {
      this.noteUnavailable(error);
    }
  }

  /** Releases the AudioContext entirely. Call when the engine will not be used again. */
  dispose(): void {
    this.stopLayers();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.current = null;
  }
}

/* ── Per-sound synthesis graphs ────────────────────────────── */

type Builder = (ctx: AudioContext, dest: AudioNode) => Layer[];

/** A looping buffer source playing the requested flavour of noise, from the shared buffer. */
function noiseSource(ctx: AudioContext, type: NoiseType): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, type);
  src.loop = true;
  return src;
}

/**
 * Somewhere random inside the shared buffer.
 *
 * Every voice used to get freshly generated noise, so no two were ever alike.
 * Now that they read from one buffer, starting them all at zero would play the
 * same 80 ms of noise for every raindrop — a repeating tick rather than rain —
 * and would lock layers of the same flavour into phase with each other. Reading
 * from a different offset each time restores the variety the generation used to
 * provide, for the price of one random number.
 */
function randomOffset(): number {
  return Math.random() * NOISE_SECONDS;
}

/** One steady voice of a soundscape: noise shaped by a filter, at a fixed gain, optionally breathing under a slow LFO. */
function simpleLayer(
  ctx: AudioContext,
  dest: AudioNode,
  opts: {
    noise: 'white' | 'pink' | 'brown';
    filter: BiquadFilterType;
    frequency: number;
    q?: number;
    gain: number;
    /** Slow LFO on gain, giving the sound a natural swell. */
    lfoHz?: number;
    lfoDepth?: number;
  },
): Layer {
  const src = noiseSource(ctx, opts.noise);
  const filter = ctx.createBiquadFilter();
  filter.type = opts.filter;
  filter.frequency.value = opts.frequency;
  if (opts.q !== undefined) filter.Q.value = opts.q;

  const gain = ctx.createGain();
  gain.gain.value = opts.gain;

  src.connect(filter).connect(gain).connect(dest);
  src.start(0, randomOffset());

  const nodes: AudioNode[] = [src, filter, gain];
  let lfo: OscillatorNode | null = null;

  if (opts.lfoHz) {
    lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = opts.lfoHz;
    lfoGain.gain.value = opts.lfoDepth ?? opts.gain * 0.5;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();
    nodes.push(lfo, lfoGain);
  }

  return {
    nodes,
    stop: () => {
      try {
        src.stop();
        lfo?.stop();
      } catch {
        /* already stopped */
      }
      nodes.forEach((n) => n.disconnect());
    },
  };
}

/** Randomly timed short bursts — birdsong, crackles, cafe clatter. */
function sparkleLayer(
  ctx: AudioContext,
  dest: AudioNode,
  opts: {
    minGap: number;
    maxGap: number;
    build: (ctx: AudioContext, dest: AudioNode, at: number) => void;
  },
): Layer {
  let timer = 0;
  let stopped = false;

  const schedule = () => {
    if (stopped) return;
    const gap = opts.minGap + Math.random() * (opts.maxGap - opts.minGap);
    timer = window.setTimeout(() => {
      if (stopped) return;
      opts.build(ctx, dest, ctx.currentTime);
      schedule();
    }, gap * 1000);
  };
  schedule();

  return {
    nodes: [],
    stop: () => {
      stopped = true;
      window.clearTimeout(timer);
    },
  };
}

const BUILDERS: Record<SoundId, Builder> = {
  white: (ctx, dest) => [
    simpleLayer(ctx, dest, { noise: 'white', filter: 'lowpass', frequency: 11000, gain: 0.25 }),
  ],

  brown: (ctx, dest) => [
    simpleLayer(ctx, dest, { noise: 'brown', filter: 'lowpass', frequency: 700, gain: 0.7 }),
  ],

  rain: (ctx, dest) => [
    // Hiss of the rain itself.
    simpleLayer(ctx, dest, { noise: 'white', filter: 'bandpass', frequency: 2400, q: 0.6, gain: 0.16 }),
    // Body — the sound of it hitting surfaces.
    simpleLayer(ctx, dest, { noise: 'pink', filter: 'lowpass', frequency: 1000, gain: 0.3, lfoHz: 0.08, lfoDepth: 0.08 }),
    // Occasional heavier drops.
    sparkleLayer(ctx, dest, {
      minGap: 0.05,
      maxGap: 0.4,
      build: (c, d, at) => {
        const src = noiseSource(c, 'white');
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1200 + Math.random() * 3000;
        bp.Q.value = 8;
        const g = c.createGain();
        g.gain.setValueAtTime(0.05 + Math.random() * 0.05, at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
        src.connect(bp).connect(g).connect(d);
        src.start(at, randomOffset());
        src.stop(at + 0.08);
      },
    }),
  ],

  ocean: (ctx, dest) => [
    // Slow swell — the LFO does the work here.
    simpleLayer(ctx, dest, { noise: 'brown', filter: 'lowpass', frequency: 500, gain: 0.35, lfoHz: 0.09, lfoDepth: 0.3 }),
    simpleLayer(ctx, dest, { noise: 'white', filter: 'bandpass', frequency: 900, q: 0.4, gain: 0.1, lfoHz: 0.07, lfoDepth: 0.09 }),
  ],

  wind: (ctx, dest) => [
    simpleLayer(ctx, dest, { noise: 'pink', filter: 'bandpass', frequency: 500, q: 0.8, gain: 0.3, lfoHz: 0.05, lfoDepth: 0.22 }),
    simpleLayer(ctx, dest, { noise: 'white', filter: 'highpass', frequency: 2000, gain: 0.05, lfoHz: 0.12, lfoDepth: 0.04 }),
  ],

  forest: (ctx, dest) => [
    // Leaves.
    simpleLayer(ctx, dest, { noise: 'pink', filter: 'bandpass', frequency: 1800, q: 0.5, gain: 0.12, lfoHz: 0.06, lfoDepth: 0.08 }),
    simpleLayer(ctx, dest, { noise: 'brown', filter: 'lowpass', frequency: 400, gain: 0.18 }),
    // Birds — short frequency-swept chirps.
    sparkleLayer(ctx, dest, {
      minGap: 1.5,
      maxGap: 6,
      build: (c, d, at) => {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sine';
        const base = 2200 + Math.random() * 1600;
        osc.frequency.setValueAtTime(base, at);
        osc.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.5), at + 0.08);
        osc.frequency.exponentialRampToValueAtTime(base * 0.85, at + 0.18);
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(0.05, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
        osc.connect(g).connect(d);
        osc.start(at);
        osc.stop(at + 0.25);
      },
    }),
  ],

  cafe: (ctx, dest) => [
    // The murmur: low band-passed noise sits where voices do.
    simpleLayer(ctx, dest, { noise: 'pink', filter: 'bandpass', frequency: 500, q: 0.7, gain: 0.22, lfoHz: 0.15, lfoDepth: 0.07 }),
    simpleLayer(ctx, dest, { noise: 'brown', filter: 'lowpass', frequency: 300, gain: 0.15 }),
    // Cups, cutlery, the espresso machine.
    sparkleLayer(ctx, dest, {
      minGap: 0.8,
      maxGap: 4,
      build: (c, d, at) => {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 1800 + Math.random() * 2800;
        g.gain.setValueAtTime(0.03 + Math.random() * 0.02, at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
        osc.connect(g).connect(d);
        osc.start(at);
        osc.stop(at + 0.14);
      },
    }),
  ],

  fireplace: (ctx, dest) => [
    // The low roar of the fire.
    simpleLayer(ctx, dest, { noise: 'brown', filter: 'lowpass', frequency: 420, gain: 0.4, lfoHz: 0.3, lfoDepth: 0.12 }),
    // Crackles and pops.
    sparkleLayer(ctx, dest, {
      minGap: 0.08,
      maxGap: 0.9,
      build: (c, d, at) => {
        const src = noiseSource(c, 'white');
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 900 + Math.random() * 2600;
        bp.Q.value = 5;
        const g = c.createGain();
        g.gain.setValueAtTime(0.06 + Math.random() * 0.09, at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.04 + Math.random() * 0.05);
        src.connect(bp).connect(g).connect(d);
        src.start(at, randomOffset());
        src.stop(at + 0.12);
      },
    }),
  ],
};

export const ambient = new AmbientEngine();
