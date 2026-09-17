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
  { id: 'rain', label: 'Rain', description: 'Rain at the window, thunder far off', icon: 'CloudRain' },
  { id: 'forest', label: 'Forest', description: 'Birdsong, rustling leaves, a brook', icon: 'Trees' },
  { id: 'ocean', label: 'Ocean', description: 'Waves breaking and washing back', icon: 'Waves' },
  { id: 'cafe', label: 'Coffee shop', description: 'Quiet chatter, cups, the espresso bar', icon: 'Coffee' },
  { id: 'white', label: 'White noise', description: 'Flat, even masking', icon: 'AudioLines' },
  { id: 'brown', label: 'Brown noise', description: 'Deep, warm low-end', icon: 'Activity' },
  { id: 'fireplace', label: 'Fireplace', description: 'Crackling logs, the odd pop', icon: 'Flame' },
  { id: 'wind', label: 'Wind', description: 'Shifting gusts through the trees', icon: 'Wind' },
];

type NoiseType = 'white' | 'pink' | 'brown';

/**
 * Seconds of noise held per flavour. Two seconds was short enough to hear: a
 * steady bed of filtered noise repeating every two seconds has a faint rhythm
 * the ear finds within a minute, and it made every sound feel mechanical. Six
 * puts the period well past that, for about a megabyte per flavour.
 */
export const NOISE_SECONDS = 6;

/**
 * One buffer per flavour, per context.
 *
 * Generating noise is not cheap: six seconds at 44.1 kHz is 264,600 samples,
 * about a megabyte, and a few milliseconds of the main thread. Paid on every
 * raindrop and every crackle of the fire — sounds that last 40 to 80 ms — rain
 * would churn megabytes a second to play the same texture over and over, on
 * the one screen meant to feel calm.
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

/** `NOISE_SECONDS` of noise, looped — long enough that the period isn't audible. */
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

/** The tick sits well under the chime — a clock in the room, not a metronome. */
const TICK_LEVEL = 0.25;

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

  /**
   * Creates and resumes the audio context from inside a user gesture.
   *
   * Browsers only let audio start in response to a click or a key press. A
   * sound played on a timer — the ticking clock — has no gesture of its own, so
   * starting a session unlocks the context for it ahead of time.
   */
  async prime(): Promise<void> {
    try {
      const ctx = this.ensureContext();
      if (ctx.state === 'suspended') await ctx.resume();
    } catch (error) {
      this.noteUnavailable(error);
    }
  }

  /**
   * One tick of the optional ticking clock: a short, dry click, well under the
   * chime and following the same volume setting.
   *
   * A context that is not running is left alone rather than resumed. Ticks come
   * from an interval, not a gesture, so a resume would be refused every second;
   * the context is unlocked when the session starts instead (see `prime`).
   */
  tick(volume = this.volume): void {
    const peak = chimePeak(volume) * TICK_LEVEL;
    if (peak <= 0) return;

    try {
      const ctx = this.ensureContext();
      if (ctx.state !== 'running') return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 1400;
      const start = ctx.currentTime;
      gain.gain.setValueAtTime(peak, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.03);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.04);
    } catch (error) {
      this.noteUnavailable(error);
    }
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

/**
 * What made the first versions sound flat was not the noise but the motion: a
 * sine LFO swells on a fixed period, every event was one identical blip, and
 * everything sat dead centre. Real ambience does none of that. So the graphs
 * below are built from four pieces — steady beds that drift at random, events
 * that arrive in clusters and phrases, a stereo position for each, and a bus
 * per layer so a ten-second wave never outlives a switch to another sound.
 */

type Builder = (ctx: AudioContext, dest: AudioNode) => Layer[];

type Range = readonly [number, number];

/** The floor exponential ramps start from and fall to — they cannot reach zero. */
const SILENT = 0.0001;

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

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

/**
 * Routes into `dest` from a position in the stereo field. Browsers without a
 * stereo panner (and centred sounds) connect straight through.
 */
function panTo(ctx: AudioContext, dest: AudioNode, pan: number): AudioNode {
  if (pan === 0 || typeof ctx.createStereoPanner !== 'function') return dest;
  const panner = ctx.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));
  panner.connect(dest);
  return panner;
}

/**
 * Glides a parameter to a fresh random value inside `range` every so often.
 *
 * This replaces the sine LFO. A sine swells on a period the ear locks onto
 * within a minute; a random walk with uneven steps never settles into one, which
 * is what keeps rain from sounding like a machine breathing.
 */
function wander(
  ctx: AudioContext,
  param: AudioParam,
  range: Range,
  every: Range,
  glide: number,
): () => void {
  let timer = 0;
  let stopped = false;
  param.value = rand(...range);

  const step = () => {
    if (stopped) return;
    param.setTargetAtTime(rand(...range), ctx.currentTime, glide / 3);
    timer = window.setTimeout(step, rand(...every) * 1000);
  };
  timer = window.setTimeout(step, rand(...every) * 1000);

  return () => {
    stopped = true;
    window.clearTimeout(timer);
  };
}

/** One continuous voice: filtered noise, placed in the stereo field, with its level and tone either fixed or drifting. */
function bed(
  ctx: AudioContext,
  dest: AudioNode,
  opts: {
    noise: NoiseType;
    filter: BiquadFilterType;
    /** A fixed cutoff, or a range for it to drift within. */
    frequency: number | Range;
    q?: number;
    /** A fixed level, or a range for it to drift within. */
    gain: number | Range;
    pan?: number;
    /** Seconds between drift targets. */
    every?: Range;
    /** Roughly how long each drift takes to arrive, in seconds. */
    glide?: number;
  },
): Layer {
  const src = noiseSource(ctx, opts.noise);
  const filter = ctx.createBiquadFilter();
  filter.type = opts.filter;
  if (opts.q !== undefined) filter.Q.value = opts.q;
  const gain = ctx.createGain();
  const out = panTo(ctx, dest, opts.pan ?? 0);

  src.connect(filter).connect(gain).connect(out);
  const nodes: AudioNode[] = [src, filter, gain];
  if (out !== dest) nodes.push(out);

  const every = opts.every ?? [4, 10];
  const glide = opts.glide ?? 3;
  const stoppers: (() => void)[] = [];
  const drive = (param: AudioParam, value: number | Range) => {
    if (typeof value === 'number') param.value = value;
    else stoppers.push(wander(ctx, param, value, every, glide));
  };
  drive(filter.frequency, opts.frequency);
  drive(gain.gain, opts.gain);

  src.start(0, randomOffset());

  return {
    nodes,
    stop: () => {
      stoppers.forEach((s) => s());
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      nodes.forEach((n) => n.disconnect());
    },
  };
}

/**
 * Something that happens now and then — a drop, a wave, a birdsong phrase.
 *
 * Each event is built into this layer's own bus rather than straight into the
 * soundscape. Events schedule into the future (a wave takes ten seconds to
 * wash out), and switching sounds must silence them at once, not let the ocean
 * finish breaking over the fireplace.
 */
function events(
  ctx: AudioContext,
  dest: AudioNode,
  opts: {
    /** Seconds until the next event, asked afresh each time. */
    gap: () => number;
    build: (ctx: AudioContext, dest: AudioNode, at: number) => void;
  },
): Layer {
  const bus = ctx.createGain();
  bus.connect(dest);
  let timer = 0;
  let stopped = false;

  const schedule = () => {
    if (stopped) return;
    timer = window.setTimeout(() => {
      if (stopped) return;
      // A hair of lookahead, so a start time is never already in the past.
      opts.build(ctx, bus, ctx.currentTime + 0.02);
      schedule();
    }, opts.gap() * 1000);
  };
  schedule();

  return {
    nodes: [bus],
    stop: () => {
      stopped = true;
      window.clearTimeout(timer);
      bus.disconnect();
    },
  };
}

/** A percussive shape on `param`: up to `peak` over `attack`, then away over `decay`. */
function envelope(param: AudioParam, at: number, peak: number, attack: number, decay: number): void {
  param.setValueAtTime(SILENT, at);
  param.exponentialRampToValueAtTime(Math.max(peak, SILENT), at + attack);
  param.exponentialRampToValueAtTime(SILENT, at + attack + decay);
}

/** A short burst of filtered noise. Returns the filter, for callers that sweep it. */
function noiseHit(
  ctx: AudioContext,
  dest: AudioNode,
  at: number,
  opts: {
    noise?: NoiseType;
    filter?: BiquadFilterType;
    frequency: number;
    q?: number;
    peak: number;
    attack?: number;
    decay: number;
    pan?: number;
  },
): BiquadFilterNode {
  const attack = opts.attack ?? 0.002;
  const src = noiseSource(ctx, opts.noise ?? 'white');
  const filter = ctx.createBiquadFilter();
  filter.type = opts.filter ?? 'bandpass';
  filter.frequency.setValueAtTime(opts.frequency, at);
  if (opts.q !== undefined) filter.Q.value = opts.q;
  const gain = ctx.createGain();
  envelope(gain.gain, at, opts.peak, attack, opts.decay);

  src.connect(filter).connect(gain).connect(panTo(ctx, dest, opts.pan ?? 0));
  src.start(at, randomOffset());
  src.stop(at + attack + opts.decay + 0.05);
  return filter;
}

/** A short pitched note. Returns the oscillator, for callers that bend its pitch. */
function tone(
  ctx: AudioContext,
  dest: AudioNode,
  at: number,
  opts: {
    type?: OscillatorType;
    frequency: number;
    peak: number;
    attack?: number;
    decay: number;
    pan?: number;
  },
): OscillatorNode {
  const attack = opts.attack ?? 0.005;
  const osc = ctx.createOscillator();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.frequency, at);
  const gain = ctx.createGain();
  envelope(gain.gain, at, opts.peak, attack, opts.decay);

  osc.connect(gain).connect(panTo(ctx, dest, opts.pan ?? 0));
  osc.start(at);
  osc.stop(at + attack + opts.decay + 0.05);
  return osc;
}

/* ── Rain ── */

/** A drop close by — on the sill, the glass — with the occasional wet plink of a drip. */
function nearDrop(ctx: AudioContext, dest: AudioNode, at: number): void {
  const pan = rand(-0.8, 0.8);
  noiseHit(ctx, dest, at, {
    frequency: rand(900, 2600),
    q: rand(6, 14),
    peak: rand(0.03, 0.08),
    decay: rand(0.03, 0.08),
    pan,
  });
  if (Math.random() < 0.25) {
    const from = rand(900, 1700);
    const plink = tone(ctx, dest, at + 0.005, { frequency: from, peak: rand(0.006, 0.014), decay: 0.07, pan });
    plink.frequency.exponentialRampToValueAtTime(from * rand(1.6, 2.2), at + 0.06);
  }
}

/** Thunder a long way off: a slow, soft roll that never arrives as a clap. */
function distantThunder(ctx: AudioContext, dest: AudioNode, at: number): void {
  const pan = rand(-0.6, 0.6);
  const size = rand(0.5, 1);
  noiseHit(ctx, dest, at, { noise: 'brown', filter: 'lowpass', frequency: 140, q: 0.5, peak: 0.3 * size, attack: 1.6, decay: rand(4, 7), pan });
  noiseHit(ctx, dest, at + rand(0.6, 1.4), { noise: 'brown', filter: 'lowpass', frequency: 90, q: 0.5, peak: 0.22 * size, attack: 1.2, decay: rand(3, 5), pan: -pan * 0.5 });
}

/* ── Ocean ── */

/**
 * One wave, start to finish: the swell building and brightening as it rises,
 * the break, the wash of foam, and — sometimes — shingle rattling as the water
 * draws back. Every wave differs in size, timing and where on the beach it lands.
 */
function wave(ctx: AudioContext, dest: AudioNode, at: number): void {
  const size = rand(0.55, 1);
  const pan = rand(-0.45, 0.45);
  const crest = at + rand(2.2, 3.8);
  const wash = rand(3.5, 6);
  const end = crest + wash;

  const src = noiseSource(ctx, 'pink');
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.3;
  filter.frequency.setValueAtTime(180, at);
  filter.frequency.exponentialRampToValueAtTime(800 + 1000 * size, crest);
  filter.frequency.exponentialRampToValueAtTime(260, end);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(SILENT, at);
  gain.gain.exponentialRampToValueAtTime(0.34 * size, crest);
  gain.gain.exponentialRampToValueAtTime(SILENT, end);
  src.connect(filter).connect(gain).connect(panTo(ctx, dest, pan));
  src.start(at, randomOffset());
  src.stop(end + 0.1);

  // Foam hissing up the sand.
  noiseHit(ctx, dest, crest - 0.3, { filter: 'highpass', frequency: 2400, peak: 0.06 * size, attack: 0.6, decay: wash, pan: -pan * 0.5 });

  // Shingle dragged back by the undertow.
  if (Math.random() < 0.6) {
    const pebbles = Math.round(12 + 20 * size);
    for (let i = 0; i < pebbles; i++) {
      noiseHit(ctx, dest, crest + wash * rand(0.3, 0.9), {
        frequency: rand(2500, 6500),
        q: 4,
        peak: rand(0.004, 0.012) * size,
        decay: rand(0.01, 0.03),
        pan: pan + rand(-0.35, 0.35),
      });
    }
  }
}

/* ── Wind ── */

/** A gust passing through nearby leaves: a scatter of rustles that sweeps across the field. */
function leafGust(ctx: AudioContext, dest: AudioNode, at: number): void {
  const length = rand(1.2, 3);
  const from = rand(-0.8, 0.8);
  const to = -from * rand(0.3, 1);
  const count = Math.round(rand(20, 45));
  for (let i = 0; i < count; i++) {
    const t = Math.random();
    // Densest and loudest mid-gust.
    const swell = Math.sin(Math.PI * t);
    noiseHit(ctx, dest, at + t * length, {
      frequency: rand(2800, 6500),
      q: 1.5,
      peak: rand(0.004, 0.014) * (0.3 + swell),
      decay: rand(0.02, 0.07),
      pan: from + (to - from) * t,
    });
  }
}

/* ── Forest ── */

/** A small bird note with a quick flutter in its pitch, which is what stops a sine sounding like a sine. */
function chirp(
  ctx: AudioContext,
  dest: AudioNode,
  at: number,
  opts: { from: number; to: number; length: number; peak: number; pan: number },
): void {
  const osc = tone(ctx, dest, at, {
    frequency: opts.from,
    peak: opts.peak,
    attack: opts.length * 0.15,
    decay: opts.length * 0.85,
    pan: opts.pan,
  });
  osc.frequency.exponentialRampToValueAtTime(opts.to, at + opts.length);

  const flutter = ctx.createOscillator();
  const depth = ctx.createGain();
  flutter.frequency.value = rand(25, 60);
  depth.gain.value = opts.from * rand(0.01, 0.04);
  flutter.connect(depth).connect(osc.frequency);
  flutter.start(at);
  flutter.stop(at + opts.length + 0.05);
}

/** Sings one phrase and returns how long it took, in seconds. */
type Song = (ctx: AudioContext, dest: AudioNode, at: number, pan: number, level: number) => number;

/** A few distinct kinds of bird, so the forest has residents rather than one chirp on repeat. */
const BIRDSONG: Song[] = [
  // A quick descending trill.
  (ctx, dest, at, pan, level) => {
    const notes = Math.round(rand(5, 10));
    const base = rand(3200, 4600);
    const spacing = rand(0.06, 0.09);
    for (let i = 0; i < notes; i++) {
      const f = base * (1 - (i / notes) * 0.25);
      chirp(ctx, dest, at + i * spacing, { from: f * 1.15, to: f * 0.9, length: 0.05, peak: 0.028 * level, pan });
    }
    return notes * spacing;
  },
  // A clear two-note whistle, falling.
  (ctx, dest, at, pan, level) => {
    const f = rand(2700, 3400);
    chirp(ctx, dest, at, { from: f, to: f * 0.97, length: 0.32, peak: 0.022 * level, pan });
    chirp(ctx, dest, at + 0.42, { from: f * 0.84, to: f * 0.8, length: 0.36, peak: 0.02 * level, pan });
    return 0.8;
  },
  // A rising, questioning phrase of three.
  (ctx, dest, at, pan, level) => {
    const f = rand(2200, 2900);
    for (let i = 0; i < 3; i++) {
      chirp(ctx, dest, at + i * 0.18, { from: f * (1 + i * 0.12), to: f * (1.25 + i * 0.12), length: 0.12, peak: 0.022 * level, pan });
    }
    return 0.55;
  },
  // A far-off woodpecker.
  (ctx, dest, at, pan, level) => {
    const knocks = Math.round(rand(10, 18));
    const spacing = rand(0.05, 0.07);
    for (let i = 0; i < knocks; i++) {
      noiseHit(ctx, dest, at + i * spacing, {
        frequency: rand(800, 1000),
        q: 5,
        peak: 0.03 * level * (1 - i / (knocks * 1.5)),
        decay: 0.02,
        pan,
      });
    }
    return knocks * spacing;
  },
];

/** One bird sings; now and then another, elsewhere in the trees, answers. */
function birdPhrase(ctx: AudioContext, dest: AudioNode, at: number): void {
  const song = pick(BIRDSONG);
  const pan = rand(-0.85, 0.85);
  const level = rand(0.4, 1);
  const length = song(ctx, dest, at, pan, level);
  if (Math.random() < 0.4) {
    song(ctx, dest, at + length + rand(0.6, 1.8), -pan * rand(0.5, 1), level * rand(0.4, 0.8));
  }
}

/* ── Coffee shop ── */

/** Ceramic on ceramic: a few inharmonic partials, as a cup has, each dying away at its own rate. */
function clink(ctx: AudioContext, dest: AudioNode, at: number, level: number, pan: number): void {
  const f = rand(1700, 2700);
  const partials: [ratio: number, gain: number, decay: number][] = [
    [1, 1, 0.22],
    [2.32, 0.5, 0.14],
    [4.25, 0.25, 0.08],
  ];
  for (const [ratio, gain, decay] of partials) {
    tone(ctx, dest, at, { frequency: f * ratio, peak: 0.018 * level * gain, attack: 0.001, decay, pan });
  }
}

/** The small sounds of a room full of people: cups set down, a spoon stirring. */
function tableware(ctx: AudioContext, dest: AudioNode, at: number): void {
  const pan = rand(-0.8, 0.8);
  const level = rand(0.4, 1);
  if (Math.random() < 0.2) {
    const stirs = Math.round(rand(5, 9));
    const spacing = rand(0.11, 0.14);
    for (let i = 0; i < stirs; i++) clink(ctx, dest, at + i * spacing, level * 0.35, pan);
    return;
  }
  clink(ctx, dest, at, level, pan);
  // Cup onto saucer: a second, softer knock right after.
  if (Math.random() < 0.35) clink(ctx, dest, at + rand(0.06, 0.12), level * 0.6, pan);
}

/** The espresso machine behind the counter: knocking out the grounds, then the steam wand. */
function espresso(ctx: AudioContext, dest: AudioNode, at: number): void {
  const pan = rand(-0.5, 0.5);
  const spacing = rand(0.22, 0.3);
  for (let i = 0; i < 3; i++) {
    noiseHit(ctx, dest, at + i * spacing, { noise: 'pink', frequency: 320, q: 2, peak: 0.06, decay: 0.08, pan });
  }
  noiseHit(ctx, dest, at + rand(1.5, 3), { filter: 'highpass', frequency: 3800, peak: 0.03, attack: 0.4, decay: rand(4, 6), pan });
}

/* ── Fireplace ── */

/** A tight cluster of crackles — fire rarely pops just once. */
function crackles(ctx: AudioContext, dest: AudioNode, at: number, level = 1): void {
  const pan = rand(-0.5, 0.5);
  const count = Math.round(rand(1, 5));
  let t = at;
  for (let i = 0; i < count; i++) {
    noiseHit(ctx, dest, t, {
      frequency: rand(1500, 5500),
      q: rand(2, 6),
      peak: rand(0.03, 0.12) * level,
      decay: rand(0.004, 0.03),
      pan: pan + rand(-0.1, 0.1),
    });
    t += rand(0.005, 0.04);
  }
}

/** A pocket of sap giving way: a louder pop with some body, and a spray of embers after. */
function pop(ctx: AudioContext, dest: AudioNode, at: number): void {
  const pan = rand(-0.4, 0.4);
  noiseHit(ctx, dest, at, { frequency: rand(800, 1400), q: 1, peak: 0.16, decay: 0.05, pan });
  noiseHit(ctx, dest, at, { noise: 'brown', filter: 'lowpass', frequency: 180, peak: 0.18, decay: 0.12, pan });
  for (let i = 0; i < 10; i++) {
    noiseHit(ctx, dest, at + rand(0.05, 0.6), {
      frequency: rand(4000, 7500),
      q: 3,
      peak: rand(0.005, 0.015),
      decay: 0.01,
      pan: pan + rand(-0.3, 0.3),
    });
  }
}

/** A log settling in the grate — a soft thud, and the fire flaring after it. */
function logShift(ctx: AudioContext, dest: AudioNode, at: number): void {
  noiseHit(ctx, dest, at, { noise: 'brown', filter: 'lowpass', frequency: 220, peak: 0.22, attack: 0.03, decay: 0.6, pan: rand(-0.3, 0.3) });
  for (let i = 0; i < 6; i++) crackles(ctx, dest, at + 0.3 + rand(0, 1.5), 0.8);
}

/**
 * Plays a soundscape through a fixed trim, so it lands at the loudness the
 * volume slider has always produced for it. Spreading a sound across the
 * stereo field and leaving gaps between events both make it quieter overall;
 * without this, anyone's saved volume would suddenly sound too low.
 */
function atLevel(level: number, build: Builder): Builder {
  return (ctx, dest) => {
    const trim = ctx.createGain();
    trim.gain.value = level;
    trim.connect(dest);
    return [...build(ctx, trim), { nodes: [trim], stop: () => trim.disconnect() }];
  };
}

/** Trims matched by measurement, in stereo, against the previous version of each sound at the same volume. */
const BUILDERS: Record<SoundId, Builder> = {
  // Kept steady — masking is the point — but spread left and right from
  // different offsets, which sits far more comfortably in headphones than mono.
  white: atLevel(1.6, (ctx, dest) => [
    bed(ctx, dest, { noise: 'white', filter: 'lowpass', frequency: 9000, gain: 0.17, pan: -0.7 }),
    bed(ctx, dest, { noise: 'white', filter: 'lowpass', frequency: 9000, gain: 0.17, pan: 0.7 }),
  ]),

  brown: atLevel(1.4, (ctx, dest) => [
    bed(ctx, dest, { noise: 'brown', filter: 'lowpass', frequency: [550, 750], gain: 0.5, pan: -0.6, every: [15, 30], glide: 10 }),
    bed(ctx, dest, { noise: 'brown', filter: 'lowpass', frequency: [550, 750], gain: 0.5, pan: 0.6, every: [15, 30], glide: 10 }),
  ]),

  rain: atLevel(1.4, (ctx, dest) => [
    // The wide hiss of rain falling everywhere, left and right drifting apart.
    bed(ctx, dest, { noise: 'pink', filter: 'bandpass', frequency: [2600, 3600], q: 0.5, gain: [0.08, 0.16], pan: -0.5, every: [4, 9], glide: 5 }),
    bed(ctx, dest, { noise: 'pink', filter: 'bandpass', frequency: [2600, 3600], q: 0.5, gain: [0.08, 0.16], pan: 0.5, every: [4, 9], glide: 5 }),
    // Body — rain on roofs and pavement, easing and intensifying over minutes.
    bed(ctx, dest, { noise: 'pink', filter: 'lowpass', frequency: [700, 1100], gain: [0.16, 0.3], every: [8, 18], glide: 8 }),
    bed(ctx, dest, { noise: 'brown', filter: 'lowpass', frequency: 200, gain: 0.18 }),
    // Fine patter all around.
    events(ctx, dest, {
      gap: () => rand(0.015, 0.06),
      build: (c, d, at) =>
        void noiseHit(c, d, at, {
          frequency: rand(3000, 8000),
          q: 1.5,
          peak: rand(0.006, 0.02),
          decay: rand(0.008, 0.025),
          pan: rand(-0.95, 0.95),
        }),
    }),
    events(ctx, dest, { gap: () => rand(0.12, 1.1), build: nearDrop }),
    events(ctx, dest, { gap: () => rand(80, 220), build: distantThunder }),
  ]),

  ocean: atLevel(2.3, (ctx, dest) => [
    // The sea further out, never quite silent between waves.
    bed(ctx, dest, { noise: 'brown', filter: 'lowpass', frequency: 220, gain: [0.18, 0.3], every: [6, 12], glide: 6 }),
    bed(ctx, dest, { noise: 'pink', filter: 'bandpass', frequency: 700, q: 0.5, gain: [0.015, 0.05], pan: -0.5, every: [5, 10], glide: 5 }),
    bed(ctx, dest, { noise: 'pink', filter: 'bandpass', frequency: 700, q: 0.5, gain: [0.015, 0.05], pan: 0.5, every: [5, 10], glide: 5 }),
    events(ctx, dest, { gap: () => rand(5.5, 10), build: wave }),
  ]),

  wind: atLevel(1.6, (ctx, dest) => [
    // Two gusting bodies, one each side, moving independently — the wind
    // shifts direction instead of swelling in place.
    bed(ctx, dest, { noise: 'pink', filter: 'bandpass', frequency: [250, 750], q: 0.9, gain: [0.06, 0.32], pan: -0.6, every: [2, 6], glide: 3 }),
    bed(ctx, dest, { noise: 'pink', filter: 'bandpass', frequency: [250, 750], q: 0.9, gain: [0.06, 0.32], pan: 0.6, every: [2, 6], glide: 3 }),
    // The low weight of moving air.
    bed(ctx, dest, { noise: 'brown', filter: 'lowpass', frequency: 160, gain: [0.1, 0.24], every: [5, 12], glide: 5 }),
    // A faint whistle round a corner, bending in pitch.
    bed(ctx, dest, { noise: 'white', filter: 'bandpass', frequency: [650, 1300], q: 18, gain: [0, 0.05], every: [3, 8], glide: 4 }),
    events(ctx, dest, { gap: () => rand(4, 12), build: leafGust }),
  ]),

  forest: atLevel(1.6, (ctx, dest) => [
    // Leaves on either side, stirring on their own schedules.
    bed(ctx, dest, { noise: 'pink', filter: 'bandpass', frequency: [1800, 2600], q: 0.5, gain: [0.025, 0.09], pan: -0.5, every: [2, 7], glide: 3 }),
    bed(ctx, dest, { noise: 'pink', filter: 'bandpass', frequency: [1800, 2600], q: 0.5, gain: [0.025, 0.09], pan: 0.5, every: [2, 7], glide: 3 }),
    bed(ctx, dest, { noise: 'brown', filter: 'lowpass', frequency: 300, gain: 0.12 }),
    // A brook off to one side, babbling — its level flickers quickly.
    bed(ctx, dest, { noise: 'pink', filter: 'bandpass', frequency: [1200, 2000], q: 0.8, gain: [0.012, 0.035], pan: 0.65, every: [0.25, 0.8], glide: 0.3 }),
    events(ctx, dest, { gap: () => rand(1.8, 7), build: birdPhrase }),
    events(ctx, dest, { gap: () => rand(6, 15), build: leafGust }),
  ]),

  cafe: atLevel(1.3, (ctx, dest) => [
    // Room tone.
    bed(ctx, dest, { noise: 'brown', filter: 'lowpass', frequency: 260, gain: 0.14 }),
    // Conversation: voice-band noise at a few spots in the room, each rising
    // and falling at the rhythm of syllables, so it reads as talk, not hiss.
    ...(
      [
        [380, -0.6],
        [620, -0.2],
        [950, 0.25],
        [1400, 0.6],
      ] as const
    ).map(([frequency, pan]) =>
      bed(ctx, dest, { noise: 'pink', filter: 'bandpass', frequency, q: 1.2, gain: [0.008, 0.07], pan, every: [0.12, 0.35], glide: 0.12 }),
    ),
    // The whole room getting busier and quieter.
    bed(ctx, dest, { noise: 'pink', filter: 'bandpass', frequency: 700, q: 0.6, gain: [0.04, 0.12], every: [6, 14], glide: 6 }),
    events(ctx, dest, { gap: () => rand(0.8, 4.5), build: tableware }),
    events(ctx, dest, { gap: () => rand(40, 110), build: espresso }),
  ]),

  fireplace: atLevel(1.2, (ctx, dest) => [
    // The roar, breathing unevenly as the flames catch and settle.
    bed(ctx, dest, { noise: 'brown', filter: 'lowpass', frequency: [260, 480], gain: [0.26, 0.42], every: [0.8, 2.5], glide: 1.2 }),
    // Hiss of sap and gas.
    bed(ctx, dest, { noise: 'white', filter: 'bandpass', frequency: 4200, q: 0.8, gain: [0.004, 0.018], pan: 0.2, every: [0.4, 1.6], glide: 0.6 }),
    events(ctx, dest, { gap: () => rand(0.06, 0.6), build: (c, d, at) => crackles(c, d, at) }),
    events(ctx, dest, { gap: () => rand(5, 16), build: pop }),
    events(ctx, dest, { gap: () => rand(35, 90), build: logShift }),
  ]),
};

export const ambient = new AmbientEngine();
