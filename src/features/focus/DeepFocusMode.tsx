import { useMemo, useState } from 'react';
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
import { SoundPicker } from './SoundPicker';
import { useTimerStore } from '@/store/useTimerStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useHotkeys } from '@/hooks/useHotkeys';
import { usePictureInPicture } from '@/hooks/usePictureInPicture';
import { cn, formatClock, formatTime } from '@/lib/utils';
import { labelForType, progress as progressOf, projectedEndAt, remainingMs } from '@/engine/timerEngine';

export function DeepFocusMode({ onClose }: { onClose: () => void }) {
  const timer = useTimerStore((s) => s.timer);
  useTimerStore((s) => s.tick);
  const taskTitle = useTimerStore((s) => s.taskTitle);
  const distractionCount = useTimerStore((s) => s.distractionCount);
  const toggle = useTimerStore((s) => s.toggle);
  const reset = useTimerStore((s) => s.reset);
  const skip = useTimerStore((s) => s.skip);

  const reducedMotion = useSettingsStore((s) => s.settings.reducedMotion);
  const pip = usePictureInPicture();

  const [showDistraction, setShowDistraction] = useState(false);
  const [showSound, setShowSound] = useState(false);

  const running = timer.status === 'running';
  const isFocus = timer.type === 'focus';
  const remaining = remainingMs(timer);
  const pct = progressOf(timer);
  const endsAt = projectedEndAt(timer);

  useHotkeys(
    useMemo(
      () => [
        { key: ' ', handler: toggle },
        { key: 'escape', handler: onClose },
        { key: 'n', handler: () => void skip() },
        { key: 'r', handler: reset },
        { key: 'd', handler: () => setShowDistraction(true) },
        { key: 's', handler: () => setShowSound((v) => !v) },
        { key: 'p', handler: () => void pip.toggle() },
      ],
      [toggle, onClose, skip, reset, pip],
    ),
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-40 flex flex-col bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Deep focus mode"
    >
      {/* Ambient background — two slow-drifting radial washes tinted by session type */}
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
              <Button variant="ghost" size="icon-sm" onClick={() => void pip.toggle()}>
                <PictureInPicture2 className="h-4 w-4" />
              </Button>
            </Tooltip>
          )}
          <Tooltip content="Ambient sound (S)">
            <Button variant="ghost" size="icon-sm" onClick={() => setShowSound((v) => !v)}>
              <Volume2 className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Exit deep focus (Esc)">
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
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
            <Button variant="ghost" size="icon-lg" onClick={reset} className="rounded-full">
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
            <Button variant="ghost" size="icon-lg" onClick={() => void skip()} className="rounded-full">
              <SkipForward className="h-[18px] w-[18px]" />
            </Button>
          </Tooltip>
        </div>

        {/* Distraction logger — focus sessions only */}
        {isFocus && (
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

        {!isFocus && <BreakActivity type={timer.type} cycleCount={timer.cycleCount} />}
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
