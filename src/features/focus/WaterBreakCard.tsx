import { useEffect } from 'react';
import { Droplet, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/primitives';
import { useHydrationStore } from '@/store/useHydrationStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTimerStore } from '@/store/useTimerStore';
import { cn, dateKey, relativeTime } from '@/lib/utils';
import { MAX_GLASSES_PER_DAY } from '@/db/schema';

/**
 * The water reminder shown during short and long breaks. A break is the one
 * moment the user is already away from the work, so it is the cheapest possible
 * time to ask — one tap, no dialog, no interruption to the timer.
 *
 * Renders nothing outside a break, or when the reminder is switched off.
 */
export function WaterBreakCard({ className }: { className?: string }) {
  const timer = useTimerStore((s) => s.timer);
  const enabled = useSettingsStore((s) => s.settings.hydrationEnabled);
  const goal = useSettingsStore((s) => s.settings.dailyGlassGoal);

  const glasses = useHydrationStore((s) => s.glasses);
  const lastAt = useHydrationStore((s) => s.lastAt);
  const storedDate = useHydrationStore((s) => s.date);
  const loaded = useHydrationStore((s) => s.loaded);
  const load = useHydrationStore((s) => s.load);
  const logGlass = useHydrationStore((s) => s.logGlass);
  const undoGlass = useHydrationStore((s) => s.undoGlass);

  const onBreak = timer.type !== 'focus' && timer.status !== 'idle';

  // Re-read when a break starts. This is also what catches a session left open
  // past midnight: the stored date no longer matches, so the count rolls over.
  useEffect(() => {
    if (!onBreak) return;
    if (!loaded || storedDate !== dateKey()) void load();
  }, [onBreak, loaded, storedDate, load]);

  if (!enabled || !onBreak) return null;

  const met = glasses >= goal;
  const extra = Math.max(0, glasses - goal);
  const full = glasses >= MAX_GLASSES_PER_DAY;

  return (
    <Card className={cn('w-full', className)}>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-break/12 text-break">
          <Droplet className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[13px] font-semibold">Water break</p>
            <p className="tabular shrink-0 text-[12px] text-subtle">
              {glasses} / {goal}
              {extra > 0 && <span className="text-break"> +{extra}</span>}
            </p>
          </div>

          <div className="mt-2.5 flex gap-1" aria-hidden="true">
            {Array.from({ length: goal }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors duration-300',
                  i < glasses ? 'bg-break' : 'bg-subtle/25',
                )}
              />
            ))}
          </div>

          <p className="mt-2.5 text-[12px] leading-relaxed text-muted" aria-live="polite">
            {met
              ? "That's the day's target. Anything else is a bonus."
              : lastAt
                ? `Last glass ${relativeTime(lastAt)}. Mild dehydration measurably dents concentration.`
                : 'None logged today. A glass now costs you ten seconds of the break.'}
          </p>

          <div className="mt-3 flex items-center gap-1.5">
            <Button
              size="sm"
              variant={met ? 'secondary' : 'default'}
              disabled={full}
              onClick={() => void logGlass()}
            >
              <Droplet className="h-3.5 w-3.5" />
              {met ? 'One more' : 'I had a glass'}
            </Button>
            {glasses > 0 && (
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => void undoGlass()}
                aria-label="Undo last glass"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
