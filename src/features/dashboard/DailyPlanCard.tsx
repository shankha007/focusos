import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Info, Play, Sparkles } from 'lucide-react';
import { Badge, Card, CardTitle, EmptyState, Tooltip } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { useStatsStore } from '@/store/useStatsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { computeAdaptive, fmtHour } from '@/engine/adaptive';
import { MINUTE, pluralize } from '@/lib/utils';

/** The suggested running order for the day, built from the user's own history. Each block can be started in place. Hidden entirely when adaptive suggestions are switched off. */
export function DailyPlanCard({
  onStart,
}: {
  onStart: (taskId: string | null, title: string | null) => void;
}) {
  const sessions = useStatsStore((s) => s.sessions);
  const tasks = useTaskStore((s) => s.tasks);
  const settings = useSettingsStore((s) => s.settings);

  const adaptive = useMemo(
    () => computeAdaptive(sessions, tasks, settings),
    [sessions, tasks, settings],
  );

  if (!settings.adaptiveEnabled) return null;

  const { plan, sessionLength, peakWindows } = adaptive;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-accent/12 text-accent">
              <Sparkles className="h-3 w-3" />
            </span>
            <CardTitle>Today's plan</CardTitle>
          </div>
          <Badge tone={plan.confidence === 'high' ? 'accent' : 'muted'}>
            {plan.confidence} confidence
          </Badge>
        </div>

        {plan.value.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No plan yet"
            description={plan.reason}
            className="py-10"
          />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {plan.value.map((block, i) => (
                <li key={block.taskId} className="group flex items-start gap-3 px-5 py-3">
                  <span className="tabular mt-0.5 w-12 shrink-0 text-[12px] font-medium text-subtle">
                    {fmtHour(block.startHour)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{block.title}</p>
                    <p className="mt-0.5 text-[12px] text-subtle">
                      {block.sessions} {pluralize(block.sessions, 'session')} · {block.rationale}
                    </p>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => onStart(block.taskId, block.title)}
                    aria-label={`Start ${block.title}`}
                  >
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                  {i === 0 && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent" />}
                </li>
              ))}
            </ul>

            <div className="space-y-2 border-t border-border px-5 py-3.5">
              <Insight text={plan.reason} />
              <Insight
                text={`Recommended session length: ${Math.round(sessionLength.value / MINUTE)} min. ${sessionLength.reason}`}
              />
              {peakWindows.value.length > 0 && <Insight text={peakWindows.reason} />}
            </div>
          </>
        )}
      </Card>
    </motion.div>
  );
}

/** One line of reasoning under the plan, marked with an icon that explains where the suggestion came from. */
function Insight({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted">
      <Tooltip content="Derived from your own session history">
        <Info className="mt-0.5 h-3 w-3 shrink-0 text-subtle" />
      </Tooltip>
      {text}
    </p>
  );
}
