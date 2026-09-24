import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/Logo';
import { TimerRing } from '@/components/TimerRing';
import { formatClock } from '@/lib/utils';
import {
  createTimerState,
  elapsedMs,
  isComplete,
  pause,
  progress,
  remainingMs,
  reset,
  resume,
  start,
  type TimerState,
} from '@/engine/timerEngine';
import { parkSession } from './handoff';
import { findRoute } from './routes';

/**
 * A working Pomodoro timer, on the landing page and on /25-minute-timer.
 *
 * Someone searching for a timer wants a timer, not a description of one. The
 * landing page used to show a still image of Deep Focus Mode, so the first
 * thing a visitor had to do was decide to click through to an app they had not
 * seen working — the page Google ranks answered a "do it now" search with a
 * brochure.
 *
 * It deliberately runs on nothing but `timerEngine` and React state: no Dexie,
 * no stores, no settings, no audio engine. Those are what `/dashboard` lazily
 * loads, and pulling any of them here would put the whole application on the
 * critical path of the page most people arrive on. A finished session is parked
 * in localStorage (see handoff.ts) and adopted by the workspace later, so the
 * first twenty-five minutes still count.
 */

interface Preset {
  id: string;
  label: string;
  focusMin: number;
  breakMin: number;
  /** Shown under the chips, so the choice explains itself. */
  note: string;
}

const PRESETS: Preset[] = [
  { id: 'classic', label: '25 / 5', focusMin: 25, breakMin: 5, note: 'The classic Pomodoro cadence' },
  { id: 'deep', label: '50 / 10', focusMin: 50, breakMin: 10, note: 'Longer stretches for deep work' },
];

/** Presets by id, for the pages that open on something other than 25/5. */
const PRESET_BY_ID = new Map(PRESETS.map((preset) => [preset.id, preset]));

const CUSTOM_MIN = 1;
const CUSTOM_MAX = 180;

/** How often the clock is recomputed. The numbers come from timestamps, so this only drives repaints. */
const TICK_MS = 250;


/**
 * A short two-tone chime, built here rather than pulled from `lib/audio`.
 *
 * That module is the full ambient engine — oscillator graphs, noise buffers,
 * eight soundscapes — and importing it, even lazily, would download all of it
 * to play one note. Web Audio also refuses to make a sound until a user
 * gesture, which a session that started with a click has already provided.
 */
async function playChime(): Promise<void> {
  try {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    if (ctx.state === 'suspended') await ctx.resume();

    const now = ctx.currentTime;
    [880, 1318.5].forEach((frequency, index) => {
      const at = now + index * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      // Ramps rather than steps: a gain that jumps to its target clicks.
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.95);
    });

    // Contexts are a limited resource, and this one has nothing left to play.
    window.setTimeout(() => void ctx.close(), 1600);
  } catch {
    // No audio is a smaller failure than a broken timer.
  }
}

export function QuickTimer({ initialPresetId = 'classic' }: { initialPresetId?: string } = {}) {
  /**
   * Which preset the timer opens on.
   *
   * 25/5 everywhere except /study-timer, where a revision session is the point
   * and 50/10 is the honest default. A prop rather than a second component: the
   * two pages want the same timer, opened at a different length.
   */
  const initialPreset = PRESET_BY_ID.get(initialPresetId) ?? PRESETS[0];

  const [preset, setPreset] = useState<Preset>(initialPreset);
  const [customMin, setCustomMin] = useState(30);
  /**
   * What is actually in the field.
   *
   * Clamping on every keystroke fought the person typing: emptying the field to
   * replace "30" snapped it to 1, so the next digit landed on that instead of
   * on an empty box. The text is kept as typed and only turned into minutes
   * when it parses inside the range.
   */
  const [customText, setCustomText] = useState('30');
  const [custom, setCustom] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [finished, setFinished] = useState(false);

  const focusMin = custom ? customMin : preset.focusMin;
  const breakMin = custom ? Math.max(1, Math.round(customMin / 5)) : preset.breakMin;

  const [timer, setTimer] = useState<TimerState>(() =>
    createTimerState('focus', initialPreset.focusMin * 60_000),
  );
  // Repaints only. Every displayed number is derived from `timer` and this.
  const [now, setNow] = useState(() => Date.now());

  // Read by the interval callback, which must not be torn down and rebuilt on
  // every tick just to see the latest state.
  const timerRef = useRef(timer);
  useEffect(() => {
    timerRef.current = timer;
  }, [timer]);

  /**
   * The title of the page this timer is on, not of the page it was written for.
   *
   * It runs on "/" and on /25-minute-timer, and a countdown has to be peeled
   * back off to whichever of them the visitor is actually reading. Read from
   * the route table — the same one the pre-renderer writes titles from — rather
   * than from document.title, which by then may be a countdown this component
   * put there itself.
   */
  const { pathname } = useLocation();
  const pageTitle = findRoute(pathname)?.title ?? 'FocusOS';
  const pageTitleRef = useRef(pageTitle);
  useEffect(() => {
    pageTitleRef.current = pageTitle;
  }, [pageTitle]);

  const running = timer.status === 'running';
  const idle = timer.status === 'idle';
  const left = remainingMs(timer, now);
  const minutesIn = Math.floor(elapsedMs(timer, now) / 60_000);

  // Leaving the page mid-session must not leave the countdown in the tab.
  useEffect(
    () => () => {
      document.title = pageTitleRef.current;
    },
    [],
  );

  /** Ends a run that has reached zero: chime, park a finished focus session, show the result. */
  const complete = useCallback(
    (state: TimerState) => {
      void playChime();
      if (!onBreak && state.startedAt !== null) {
        parkSession({
          startedAt: state.startedAt,
          endedAt: state.startedAt + state.durationMs + state.pausedAccumMs,
          plannedMs: state.durationMs,
          actualMs: state.durationMs,
        });
        setFinished(true);
      }
      setTimer(reset(state));
      setOnBreak(false);
    },
    [onBreak],
  );

  // A timestamp-driven clock still needs something to trigger repaints, and it
  // has to keep working when the tab is in the background — where intervals are
  // throttled to roughly once a minute. Recomputing on wake covers the gap: the
  // numbers are read from Date.now(), so a throttled tab is only ever displaying
  // a stale frame, never losing time.
  useEffect(() => {
    if (timer.status !== 'running' && timer.status !== 'paused') return;

    // Completion is decided here rather than in an effect watching the clock:
    // the effect would set state during render-commit on the very tick that
    // reaches zero, and cascading renders are what the repaint loop is trying
    // to keep cheap. `timerRef` is what lets this callback see the current
    // state without re-subscribing the interval on every tick.
    const tick = () => {
      const at = Date.now();
      const state = timerRef.current;
      if (state.status === 'running' && isComplete(state, at)) {
        complete(state);
        return;
      }
      setNow(at);
    };
    const id = window.setInterval(tick, TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // `complete` closes over whether this is a break, so the effect has to be
    // rebuilt when that changes — not on every tick, which `timerRef` avoids.
  }, [complete, timer.status]);

  // Mirror the countdown into the tab title, the way the app does, so the clock
  // is readable from another tab — which is where it will be.
  useEffect(() => {
    if (timer.status === 'running' || timer.status === 'paused') {
      const label = onBreak ? 'Break' : 'Focus';
      const paused = timer.status === 'paused' ? ' (paused)' : '';
      document.title = `${formatClock(left)} · ${label}${paused} — FocusOS`;
    } else {
      document.title = pageTitle;
    }
  }, [left, onBreak, pageTitle, timer.status]);

  const begin = (minutes: number, kind: 'focus' | 'break') => {
    setOnBreak(kind === 'break');
    setFinished(false);
    setNow(Date.now());
    setTimer(start(createTimerState(kind === 'break' ? 'short-break' : 'focus', minutes * 60_000)));
  };

  const chooseFocus = (next: Preset | 'custom') => {
    if (next === 'custom') {
      setCustom(true);
    } else {
      setCustom(false);
      setPreset(next);
    }
    setFinished(false);
    setOnBreak(false);
    setTimer(
      createTimerState('focus', (next === 'custom' ? customMin : next.focusMin) * 60_000),
    );
  };

  const label = onBreak ? 'Break' : 'Focus session';
  const ringColor = onBreak ? 'text-break' : 'text-accent';

  return (
    <div className="panel relative overflow-hidden p-5 shadow-lift sm:p-7">
      <div aria-hidden className="lit pointer-events-none absolute inset-0" />

      <div className="relative flex items-center justify-between">
        <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-subtle">
          <span
            className={`h-1.5 w-1.5 rounded-full ${running ? 'animate-pulse bg-accent' : 'bg-subtle/50'}`}
          />
          {label}
        </span>
        <LogoMark size={26} />
      </div>

      {/* Presets only make sense before a run: changing length mid-session would
          either discard the session or silently move the finish line. */}
      {idle && !finished && (
        <div className="relative mt-5">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {PRESETS.map((option) => {
              const active = !custom && option.id === preset.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => chooseFocus(option)}
                  aria-pressed={active}
                  className={`min-h-11 rounded-lg border px-4 py-2 text-[13px] font-medium transition-colors ${
                    active
                      ? 'border-accent/40 bg-accent/10 text-accent'
                      : 'border-border text-muted hover:border-subtle/40 hover:text-fg'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => chooseFocus('custom')}
              aria-pressed={custom}
              className={`min-h-11 rounded-lg border px-4 py-2 text-[13px] font-medium transition-colors ${
                custom
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-border text-muted hover:border-subtle/40 hover:text-fg'
              }`}
            >
              Custom
            </button>
          </div>

          {custom ? (
            <div className="mt-3 flex items-center justify-center gap-2">
              <label htmlFor="quick-timer-minutes" className="text-[12.5px] text-muted">
                Minutes
              </label>
              <input
                id="quick-timer-minutes"
                type="number"
                min={CUSTOM_MIN}
                max={CUSTOM_MAX}
                value={customText}
                onChange={(event) => {
                  const text = event.target.value;
                  setCustomText(text);
                  const value = Number(text);
                  if (text === '' || !Number.isFinite(value)) return;
                  if (value < CUSTOM_MIN || value > CUSTOM_MAX) return;
                  const minutes = Math.round(value);
                  setCustomMin(minutes);
                  setTimer(createTimerState('focus', minutes * 60_000));
                }}
                onBlur={() => {
                  // Whatever half-finished thing is in the box on the way out
                  // becomes the length that is actually loaded.
                  setCustomText(String(customMin));
                }}
                className="tabular min-h-11 w-20 rounded-lg border border-border bg-elevated px-2 py-1.5 text-center text-[13px] text-fg"
              />
            </div>
          ) : (
            <p className="mt-3 text-center text-[12.5px] text-subtle">{preset.note}</p>
          )}
        </div>
      )}

      <div className="relative mt-6 grid place-items-center">
        <TimerRing progress={progress(timer, now)} size={216} strokeWidth={9} colorClass={ringColor} glow>
          <div className="text-center">
            <p
              className="tabular text-[42px] font-semibold leading-none tracking-tight text-fg"
              // Announced on the minute rather than four times a second.
              aria-live="off"
            >
              {formatClock(left)}
            </p>
            <p className="mt-2 text-[12px] text-subtle">
              {idle
                ? `${onBreak ? breakMin : focusMin} minute ${onBreak ? 'break' : 'session'}`
                : `${minutesIn} ${minutesIn === 1 ? 'minute' : 'minutes'} in`}
            </p>
          </div>
        </TimerRing>
      </div>

      {/* Every control here is size lg — 44px — rather than the default 36px.
          This is the page's primary action and most of its traffic is a thumb
          on a phone. */}
      <div className="relative mt-6 flex flex-wrap items-center justify-center gap-2">
        {idle ? (
          <Button size="lg" className="gap-2 px-6" onClick={() => begin(onBreak ? breakMin : focusMin, onBreak ? 'break' : 'focus')}>
            <Play className="h-4 w-4" />
            {onBreak ? 'Start break' : 'Start focusing'}
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              size="lg"
              className="gap-2"
              onClick={() => setTimer(running ? pause(timer) : resume(timer))}
            >
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {running ? 'Pause' : 'Resume'}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="gap-2"
              onClick={() => {
                setTimer(reset(timer));
                setOnBreak(false);
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </>
        )}
      </div>

      {/* Only after a session has actually been finished here. Asking someone to
          keep a history they have not created yet is asking them to sign up. */}
      {finished && (
        <div className="relative mt-6 rounded-xl border border-accent/25 bg-accent/8 px-4 py-3.5">
          <p className="text-[13.5px] font-medium text-fg">
            Session complete — {focusMin} {focusMin === 1 ? 'minute' : 'minutes'} focused.
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            It is saved in this browser. Open the workspace and it joins your history, streak and
            analytics.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/dashboard">
                Keep it — open FocusOS
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => begin(breakMin, 'break')}>
              Take a {breakMin} minute break
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
