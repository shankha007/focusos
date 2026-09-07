import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  SkipForward,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/primitives';
import { TimerRing } from '@/components/TimerRing';
import { DistractionLogger } from './DistractionLogger';
import { BreakActivity } from './BreakActivity';
import { WaterBreakCard } from './WaterBreakCard';
import { AmbientOrbs } from './AmbientOrbs';
import { SoundPicker } from './SoundPicker';
import { useTimerStore } from '@/store/useTimerStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useHotkeys } from '@/hooks/useHotkeys';
import { usePictureInPicture } from '@/hooks/usePictureInPicture';
import { cn, formatClock, formatTime } from '@/lib/utils';
import { labelForType, progress as progressOf, projectedEndAt, remainingMs } from '@/engine/timerEngine';

/** The full-screen session view: nothing but the ring, the time, and the controls. Everything here is reachable from the keyboard — space to start or pause, N to skip, D to log a distraction, S for sound, P to float the timer, Esc to leave. */
export function DeepFocusMode({ onClose }: { onClose: () => void }) {
  const timer = useTimerStore((s) => s.timer);
  useTimerStore((s) => s.tick);
  const taskTitle = useTimerStore((s) => s.taskTitle);
  const distractionCount = useTimerStore((s) => s.distractionCount);
  const toggle = useTimerStore((s) => s.toggle);
  // The guard that used to live here now sits in the store, so the command
  // palette's reset asks the same question this one does.
  const requestReset = useTimerStore((s) => s.requestReset);
  const skip = useTimerStore((s) => s.skip);

  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const pip = usePictureInPicture();

  const [showDistraction, setShowDistraction] = useState(false);
  const [showSound, setShowSound] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const running = timer.status === 'running';
  const isFocus = timer.type === 'focus';
  // A distraction is an interruption *of something*. Between sessions there is
  // nothing to interrupt, so the logger stays out of the way until the clock is
  // actually going.
  const inSession = timer.status === 'running' || timer.status === 'paused';
  const remaining = remainingMs(timer);
  const pct = progressOf(timer);
  const endsAt = projectedEndAt(timer);

  useHotkeys(
    useMemo(
      () => [
        { key: ' ', handler: toggle },
        { key: 'escape', handler: onClose },
        { key: 'n', handler: () => void skip() },
        { key: 'r', handler: requestReset },
        {
          key: 'd',
          handler: () => {
            if (isFocus && inSession) setShowDistraction(true);
          },
        },
        { key: 's', handler: () => setShowSound((v) => !v) },
        { key: 'p', handler: () => void pip.toggle() },
      ],
      [toggle, onClose, skip, requestReset, pip, isFocus, inSession],
    ),
  );

  /**
   * `aria-modal` alone is a promise, not a mechanism: the page underneath keeps
   * its buttons in the tab order and in the accessibility tree, so a screen
   * reader hears the dashboard's controls duplicated behind the overlay. Mark
   * everything alongside it inert for as long as it is open, and hand it back
   * untouched on the way out.
   */
  useEffect(() => {
    const overlay = overlayRef.current;
    const covered = Array.from(overlay?.parentElement?.children ?? []).filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement &&
        el !== overlay &&
        // The toast host is a live region sitting at the same level. Silencing
        // it would swallow the very confirmations this screen produces, so it
        // stays announceable and clickable.
        !el.hasAttribute('aria-live') &&
        !el.querySelector('[aria-live]'),
    );

    // Remember what each element looked like rather than assuming it was
    // untouched: StrictMode runs this twice, and putting back a guessed state
    // is how one of the two attributes ends up dropped.
    const previous = covered.map((el) => ({
      el,
      inert: el.hasAttribute('inert'),
      ariaHidden: el.getAttribute('aria-hidden'),
    }));

    for (const el of covered) {
      el.setAttribute('inert', '');
      el.setAttribute('aria-hidden', 'true');
    }

    return () => {
      for (const { el, inert, ariaHidden } of previous) {
        if (!inert) el.removeAttribute('inert');
        if (ariaHidden === null) el.removeAttribute('aria-hidden');
        else el.setAttribute('aria-hidden', ariaHidden);
      }
    };
  }, []);

  return (
    <motion.div
      ref={overlayRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-40 flex flex-col bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Deep focus mode"
    >
      {/* Ambient background — two slow-drifting radial washes tinted by session
          type, with a field of smaller lights rising through them. The washes
          set the mood; the orbs are what stop a 90-minute session from looking
          like a still image. */}
      {!reducedMotion && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            className={cn(
              'absolute -left-1/4 top-[-20%] h-[70vh] w-[70vh] rounded-full blur-[120px]',
              isFocus ? 'bg-accent/20' : 'bg-break/20',
            )}
            animate={{ x: [0, 60, -20, 0], y: [0, 40, 80, 0], scale: [1, 1.12, 0.96, 1] }}
            transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className={cn(
              'absolute -right-1/4 bottom-[-20%] h-[60vh] w-[60vh] rounded-full blur-[120px]',
              isFocus ? 'bg-focus/14' : 'bg-break/12',
            )}
            animate={{ x: [0, -50, 20, 0], y: [0, -30, -70, 0], scale: [1, 0.94, 1.1, 1] }}
            transition={{ duration: 34, repeat: Infinity, ease: 'easeInOut' }}
          />
          <AmbientOrbs type={timer.type} />
        </div>
      )}

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              running ? (isFocus ? 'animate-pulse bg-accent' : 'animate-pulse bg-break') : 'bg-subtle',
            )}
          />
          <span className="text-[13px] font-medium text-muted">
            {labelForType(timer.type)}
            {timer.status === 'paused' && ' · paused'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {pip.supported && (
            <Tooltip content="Picture-in-picture (P)">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => void pip.toggle()}
                aria-label="Picture-in-picture"
              >
                <PictureInPicture2 className="h-4 w-4" />
              </Button>
            </Tooltip>
          )}
          <Tooltip content="Ambient sound (S)">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowSound((v) => !v)}
              aria-label="Ambient sound"
            >
              <Volume2 className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Exit deep focus (Esc)">
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Exit deep focus">
              <Minimize2 className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Center */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
        {isFocus && taskTitle && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 max-w-md text-center text-lg font-medium tracking-tight sm:text-xl"
          >
            {taskTitle}
          </motion.p>
        )}

        <TimerRing
          progress={pct}
          size={typeof window !== 'undefined' && window.innerWidth < 640 ? 280 : 360}
          strokeWidth={12}
          colorClass={isFocus ? 'text-accent' : 'text-break'}
          glow
        >
          <div className="flex flex-col items-center">
            <span
              className="tabular text-[clamp(2.75rem,11vw,4.5rem)] font-semibold leading-none tracking-tight"
              role="timer"
              aria-live="off"
            >
              {formatClock(remaining)}
            </span>
            {endsAt && running && (
              <span className="mt-3 text-[13px] text-subtle">ends {formatTime(endsAt)}</span>
            )}
            {timer.status === 'paused' && (
              <span className="mt-3 text-[13px] font-medium text-warn">Paused</span>
            )}
          </div>
        </TimerRing>

        {/* Screen-reader announcement, throttled to meaningful moments only */}
        <p className="sr-only" aria-live="polite">
          {timer.status === 'paused'
            ? 'Timer paused'
            : running
              ? `${labelForType(timer.type)} in progress`
              : 'Timer stopped'}
        </p>

        {/* Controls */}
        <div className="mt-10 flex items-center gap-2">
          <Tooltip content="Reset (R)">
            <Button
              variant="ghost"
              size="icon-lg"
              onClick={requestReset}
              className="rounded-full"
              aria-label="Reset timer"
            >
              <RotateCcw className="h-[18px] w-[18px]" />
            </Button>
          </Tooltip>

          <Button
            size="lg"
            onClick={toggle}
            className="h-14 min-w-[140px] rounded-full text-[15px] shadow-glow"
          >
            {running ? (
              <>
                <Pause className="h-5 w-5" /> Pause
              </>
            ) : (
              <>
                <Play className="h-5 w-5" /> {timer.status === 'paused' ? 'Resume' : 'Start'}
              </>
            )}
          </Button>

          <Tooltip content="Skip ahead (N)">
            <Button
              variant="ghost"
              size="icon-lg"
              onClick={() => void skip()}
              className="rounded-full"
              aria-label="Skip ahead"
            >
              <SkipForward className="h-[18px] w-[18px]" />
            </Button>
          </Tooltip>
        </div>

        {/* Distraction logger — focus sessions only, and only while one runs */}
        {isFocus && inSession && (
          <button
            onClick={() => setShowDistraction(true)}
            className="mt-8 flex items-center gap-2 rounded-full border border-border px-4 py-2 text-[13px] text-muted transition-colors hover:border-warn/40 hover:text-fg"
          >
            <Zap className="h-3.5 w-3.5" />
            Log a distraction
            {distractionCount > 0 && (
              <span className="rounded-full bg-warn/15 px-1.5 py-0.5 text-[11px] font-medium text-warn">
                {distractionCount}
              </span>
            )}
          </button>
        )}

        {!isFocus && (
          <>
            <BreakActivity type={timer.type} cycleCount={timer.cycleCount} />
            <WaterBreakCard className="mt-3 w-full max-w-sm" />
          </>
        )}
      </div>

      {/* Shortcut legend */}
      <div className="relative z-10 hidden items-center justify-center gap-4 px-6 pb-6 text-[11px] text-subtle sm:flex">
        {[
          ['Space', 'start / pause'],
          ['N', 'skip'],
          ['D', 'distraction'],
          ['S', 'sound'],
          ['Esc', 'exit'],
        ].map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px]">
              {key}
            </kbd>
            {label}
          </span>
        ))}
      </div>

      <AnimatePresence>
        {showSound && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute right-4 top-16 z-20 w-[280px]"
          >
            <div className="panel p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[13px] font-semibold">Ambient sound</p>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowSound(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <SoundPicker compact />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DistractionLogger open={showDistraction} onOpenChange={setShowDistraction} />

    </motion.div>
  );
}
