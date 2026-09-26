import { motion } from 'framer-motion';
import { Maximize2, Pause, Play, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TimerRing } from '@/components/TimerRing';
import { useTimerStore } from '@/store/useTimerStore';
import { useTaskStore } from '@/store/useTaskStore';
import { cn, formatClock, formatTime } from '@/lib/utils';
import {
  labelForType,
  progress as progressOf,
  projectedEndAt,
  remainingMs,
} from '@/engine/timerEngine';

/** The dashboard's timer panel. Idle, it offers to start the next open task; running, it shows the ring, the time left, when the session ends, and the pause/skip controls. */
export function CurrentSessionCard({
  onOpenFocus,
  onStart,
}: {
  onOpenFocus: () => void;
  onStart: (taskId: string | null, title: string | null) => void;
}) {
  const timer = useTimerStore((s) => s.timer);
  useTimerStore((s) => s.tick);
  const taskTitle = useTimerStore((s) => s.taskTitle);
  const distractionCount = useTimerStore((s) => s.distractionCount);
  const toggle = useTimerStore((s) => s.toggle);
  const skip = useTimerStore((s) => s.skip);
  const tasks = useTaskStore((s) => s.tasks);

  const idle = timer.status === 'idle';
  const running = timer.status === 'running';
  const isFocus = timer.type === 'focus';
  const remaining = remainingMs(timer);
  const endsAt = projectedEndAt(timer);
  const nextTask = tasks.find((t) => t.status === 'todo' || t.status === 'active');

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={cn('lit relative overflow-hidden', idle ? 'p-6' : 'p-6')}>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <TimerRing
            progress={idle ? 0 : progressOf(timer)}
            size={148}
            strokeWidth={8}
            colorClass={isFocus ? 'text-accent' : 'text-break'}
          >
            <span className="tabular text-2xl font-semibold tracking-tight">
              {formatClock(idle ? timer.durationMs : remaining)}
            </span>
          </TimerRing>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  running ? (isFocus ? 'animate-pulse bg-accent' : 'animate-pulse bg-break') : 'bg-subtle',
                )}
              />
              <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">
                {idle ? 'Ready' : labelForType(timer.type)}
                {timer.status === 'paused' && ' · paused'}
              </p>
            </div>

            <p className="mt-1.5 truncate text-base font-medium tracking-tight">
              {idle
                ? (nextTask?.title ?? 'No task selected')
                : (taskTitle ?? labelForType(timer.type))}
            </p>

            <p className="mt-0.5 text-[13px] text-muted">
              {idle
                ? 'Start a session and the clock takes it from here.'
                : endsAt && running
                  ? `Ends at ${formatTime(endsAt)}${distractionCount > 0 ? ` · ${distractionCount} distraction${distractionCount === 1 ? '' : 's'}` : ''}`
                  : 'Paused — pick it back up when you are ready.'}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {idle ? (
                <Button onClick={() => onStart(nextTask?.id ?? null, nextTask?.title ?? null)}>
                  <Play className="h-4 w-4" />
                  Start {Math.round(timer.durationMs / 60000)}-min session
                </Button>
              ) : (
                <>
                  <Button onClick={toggle}>
                    {running ? (
                      <>
                        <Pause className="h-4 w-4" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" /> Resume
                      </>
                    )}
                  </Button>
                  <Button variant="secondary" onClick={onOpenFocus}>
                    <Maximize2 className="h-4 w-4" />
                    Deep focus
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => void skip()} aria-label="Skip">
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
