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

/** Two seconds of noise, looped — long enough that the period isn't audible. */
function makeNoiseBuffer(ctx: AudioContext, type: 'white' | 'pink' | 'brown'): AudioBuffer {
  const length = ctx.sampleRate * 2;
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

interface Layer {
  nodes: AudioNode[];
  stop: () => void;
}

export class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private layers: Layer[] = [];
  private current: SoundId | null = null;
  private volume = 0.4;

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

  get activeSound(): SoundId | null {
    return this.current;
  }

  async play(id: SoundId, volume = this.volume): Promise<void> {
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
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(volume, now + 0.2);
  }

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

  private stopLayers(): void {
    this.layers.forEach((l) => l.stop());
    this.layers = [];
  }

  /** A short, soft chime for session transitions. */
  async chime(kind: 'complete' | 'start' = 'complete'): Promise<void> {
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
      gain.gain.linearRampToValueAtTime(0.18, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 1.2);
    });
  }

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

function noiseSource(
  ctx: AudioContext,
  type: 'white' | 'pink' | 'brown',
): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, type);
  src.loop = true;
  return src;
}

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
  src.start();

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
        src.start(at);
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
        src.start(at);
        src.stop(at + 0.12);
      },
    }),
  ],
};

export const ambient = new AmbientEngine();
