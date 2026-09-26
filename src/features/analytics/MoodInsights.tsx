import { useMemo } from 'react';
import { HeartPulse } from 'lucide-react';
import type { Session } from '@/types';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { moodCorrelation } from '@/engine/analytics';
import { Chart } from './Chart';

const MOOD_LABEL = ['', 'Rough', 'Low', 'Okay', 'Good', 'Great'];

/** Relates pre-session mood to how the session was rated afterwards, and puts the correlation into a sentence — including the useful case where it turns out not to matter. */
export function MoodInsights({ sessions }: { sessions: Session[] }) {
  const data = useMemo(() => moodCorrelation(sessions), [sessions]);

  const chartData = data.byMood.map((m) => ({
    label: MOOD_LABEL[m.mood],
    productivity: +m.avgProductivity.toFixed(2),
    count: m.count,
  }));

  const insight = useMemo(() => {
    const { moodToProductivity: mood, energyToProductivity: energy } = data;
    if (mood === null && energy === null) return null;

    const strongest =
      Math.abs(mood ?? 0) >= Math.abs(energy ?? 0)
        ? { label: 'mood', value: mood }
        : { label: 'energy', value: energy };

    if (strongest.value === null) return null;
    const r = strongest.value;

    if (Math.abs(r) < 0.2)
      return `Your ${strongest.label} barely predicts how productive a session turns out — you work about the same regardless of how you feel going in. That is a useful thing to know on a bad day.`;
    if (r > 0.5)
      return `Your ${strongest.label} strongly predicts session quality. Starting when you feel good is worth more than starting on schedule.`;
    if (r > 0.2)
      return `Better ${strongest.label} going in tends to mean a better session, though it is not the whole story.`;
    return `Interestingly, higher ${strongest.label} correlates with slightly *worse* sessions — you may be over-scheduling your good days.`;
  }, [data]);

  return (
    <Card>
      <CardTitle>Mood and productivity</CardTitle>
      <CardDescription>
        {insight ?? 'Rate your mood before sessions and productivity after to unlock this.'}
      </CardDescription>

      {chartData.length < 2 ? (
        <EmptyState
          icon={HeartPulse}
          title="Not enough check-ins yet"
          description="A few more rated sessions and the relationship between how you feel and how you work will show up here."
          className="py-8"
        />
      ) : (
        <>
          <Chart
            className="mt-4"
            kind="bar"
            height={168}
            ariaLabel="Average productivity rating by mood before the session"
            data={chartData}
            label={(row) => row.label}
            value={(row) => row.productivity}
            color="rgb(var(--accent))"
            yTicks={[0, 1, 2, 3, 4, 5]}
            yWidth={26}
            cursorFill="rgb(var(--elevated))"
            tooltip={(row) => (
              <div className="rounded-xl border border-border bg-elevated px-3 py-2 shadow-lift">
                <p className="text-[11px] text-subtle">Mood: {row.label}</p>
                <p className="tabular text-[13px] font-medium">{row.productivity}/5 productivity</p>
                <p className="text-[11px] text-subtle">
                  {row.count} session{row.count === 1 ? '' : 's'}
                </p>
              </div>
            )}
          />

          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
            <Correlation label="Mood → productivity" value={data.moodToProductivity} />
            <Correlation label="Energy → productivity" value={data.energyToProductivity} />
          </div>
        </>
      )}
    </Card>
  );
}

/** One correlation coefficient with a plain-language read on how strong it is. */
function Correlation({ label, value }: { label: string; value: number | null }) {
  const strength =
    value === null
      ? '—'
      : Math.abs(value) > 0.5
        ? 'Strong'
        : Math.abs(value) > 0.25
          ? 'Moderate'
          : 'Weak';

  return (
    <div>
      <p className="text-[11px] text-subtle">{label}</p>
      <p className="tabular text-[13px] font-medium">
        {value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}`}
        <span className="ml-1.5 text-[11px] font-normal text-subtle">{strength}</span>
      </p>
    </div>
  );
}
