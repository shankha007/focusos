import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { HeartPulse } from 'lucide-react';
import type { Session } from '@/types';
import { Card, CardDescription, CardTitle, EmptyState } from '@/components/ui/primitives';
import { moodCorrelation } from '@/engine/analytics';

const MOOD_LABEL = ['', 'Rough', 'Low', 'Okay', 'Good', 'Great'];

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
          <div className="mt-4 h-[168px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'rgb(var(--subtle))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 5]}
                  ticks={[0, 1, 2, 3, 4, 5]}
                  tick={{ fontSize: 11, fill: 'rgb(var(--subtle))' }}
                  axisLine={false}
                  tickLine={false}
                  width={26}
                />
                <RTooltip
                  cursor={{ fill: 'rgb(var(--elevated))' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as (typeof chartData)[number];
                    return (
                      <div className="rounded-xl border border-border bg-elevated px-3 py-2 shadow-lift">
                        <p className="text-[11px] text-subtle">Mood: {label}</p>
                        <p className="tabular text-[13px] font-medium">
                          {row.productivity}/5 productivity
                        </p>
                        <p className="text-[11px] text-subtle">
                          {row.count} session{row.count === 1 ? '' : 's'}
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="productivity" fill="rgb(var(--accent))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
            <Correlation label="Mood → productivity" value={data.moodToProductivity} />
            <Correlation label="Energy → productivity" value={data.energyToProductivity} />
          </div>
        </>
      )}
    </Card>
  );
}

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
