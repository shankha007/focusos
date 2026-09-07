import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Download, FileJson, FileText, Sheet } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardTitle,
  EmptyState,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/primitives';
import { Heatmap } from './Heatmap';
import { CategoryBreakdown } from './CategoryBreakdown';
import { DistractionReport } from './DistractionReport';
import { MoodInsights } from './MoodInsights';
import { useStatsStore } from '@/store/useStatsStore';
import { useTaskStore } from '@/store/useTaskStore';
import {
  byHour,
  dayRange,
  focusOnly,
  summarize,
  toDayStats,
} from '@/engine/analytics';
import { fmtHour } from '@/engine/adaptive';
import { exportJson, exportPdf, exportSessionsCsv } from '@/lib/export';
import {
  Clock,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  DAY,
  formatDuration,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from '@/lib/utils';

type Period = 'day' | 'week' | 'month' | 'year';

const PERIOD_LABEL: Record<Period, string> = {
  day: 'Today',
  week: 'This week',
  month: 'This month',
  year: 'This year',
};

/**
 * Recharts picks its own tick values, so a raw `unit` prop can render things
 * like "0.45h". Format explicitly and keep the label short — the axis is only
 * as wide as `Y_AXIS_WIDTH`, and anything longer gets clipped.
 */
const hourTick = (value: number) => {
  if (value === 0) return '0';
  // Under an hour, Recharts' ticks are fractions that all round to the same
  // tenth — an axis reading "0h, 0h, 0h, 0.1h, 0.1h". Minutes keep them
  // distinct and still fit inside Y_AXIS_WIDTH.
  if (Math.abs(value) < 1) return `${Math.round(value * 60)}m`;
  if (Number.isInteger(value)) return `${value}h`;
  // A year's worth of focus reaches three digits; a decimal there is noise and
  // pushes the label wider than the axis.
  if (Math.abs(value) >= 10) return `${Math.round(value)}h`;
  return `${Number(value.toFixed(1))}h`;
};

/**
 * A whole-minute scale for the focus-per-day axis, in hours, or `undefined` to
 * let Recharts decide.
 *
 * Left to itself, Recharts divides the domain into equal fractions. Under an
 * hour those land between whole minutes — 1.25, 2.5, 3.75 — and `hourTick`
 * rounds them to labels that repeat or skip, so the axis reads "1m, 2m, 4m, 5m"
 * with no 3m and uneven gaps. Choosing the step ourselves keeps the labels
 * distinct and evenly spaced. The domain is pinned to match, since ticks
 * outside it are simply dropped. Past an hour the default fractions already
 * read well, so leave them alone.
 */
function focusAxisScale(maxHours: number): { ticks: number[]; domain: [number, number] } | undefined {
  const maxMinutes = maxHours * 60;
  if (maxMinutes <= 0 || maxMinutes >= 60) return undefined;

  // Aim for at most five gaps, on a step that reads roundly in minutes.
  const step = [1, 2, 5, 10, 15, 20, 30].find((m) => maxMinutes / m <= 5) ?? 30;
  const top = Math.ceil(maxMinutes / step) * step;

  const ticks: number[] = [];
  for (let m = 0; m <= top; m += step) ticks.push(m / 60);
  return { ticks, domain: [0, top / 60] };
}

/** Axis tick for a minutes-based scale. */
const minuteTick = (value: number) => `${Math.round(value)}m`;

/** Axis tick for minute values that have grown large enough to read better as hours. */
const minutesAsHoursTick = (value: number) => hourTick(value / 60);

/** Wide enough for the longest label these axes produce, e.g. "120m". */
const Y_AXIS_WIDTH = 38;

/** The reporting screen: headline stats, focus over time, peak hours, distraction and mood breakdowns, and a year-long heatmap — for the selected period, all computed on the device. Also the export point for CSV, JSON and PDF. */
export function AnalyticsPage() {
  const allSessions = useStatsStore((s) => s.sessions);
  const allDistractions = useStatsStore((s) => s.distractions);
  const distractionCategories = useTaskStore((s) => s.distractionCategories);
  const categories = useTaskStore((s) => s.categories);
  const [period, setPeriod] = useState<Period>('week');

  const from = useMemo(() => {
    switch (period) {
      case 'day':
        return startOfDay();
      case 'week':
        return startOfWeek();
      case 'month':
        return startOfMonth();
      case 'year':
        return startOfYear();
    }
  }, [period]);

  const sessions = useMemo(
    () => allSessions.filter((s) => s.startedAt >= from),
    [allSessions, from],
  );
  const distractions = useMemo(
    () => allDistractions.filter((d) => d.at >= from),
    [allDistractions, from],
  );

  const summary = useMemo(() => summarize(sessions, distractions), [sessions, distractions]);
  const allStats = useMemo(
    () => toDayStats(allSessions, allDistractions),
    [allSessions, allDistractions],
  );

  const series = useMemo(() => {
    const stats = toDayStats(sessions, distractions);
    return dayRange(from, Date.now(), stats).map((d) => ({
      date: d.date,
      label: new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      hours: +(d.focusMs / 3_600_000).toFixed(2),
      sessions: d.sessions,
      distractions: d.distractions,
    }));
  }, [sessions, distractions, from]);

  /** Whole-minute gridlines for the focus-per-day chart while the day is short. */
  const focusScale = useMemo(
    () => focusAxisScale(Math.max(...series.map((d) => d.hours), 0)),
    [series],
  );

  const hourly = useMemo(() => {
    const rows = byHour(sessions);
    const max = Math.max(...rows.map((r) => r.focusMs), 1);
    return rows.map((r) => ({
      hour: r.hour,
      label: fmtHour(r.hour),
      minutes: Math.round(r.focusMs / 60000),
      intensity: r.focusMs / max,
      productivity: r.avgProductivity,
    }));
  }, [sessions]);

  const peakHour = hourly.reduce((a, b) => (b.minutes > a.minutes ? b : a), hourly[0]);

  // Over a month or a year the per-hour totals run into the thousands of
  // minutes, which is both unreadable and too wide for the axis. Switch the
  // whole axis to hours once the values get big, so the ticks stay consistent.
  const hourlyTick = peakHour && peakHour.minutes >= 90 ? minutesAsHoursTick : minuteTick;
  const hasData = focusOnly(allSessions).length > 0;

  if (!hasData) {
    return (
      <PageContainer>
        <PageHeader title="Analytics" subtitle="Your focus patterns, once there are some." />
        <Card>
          <EmptyState
            icon={BarChart3}
            title="No data yet"
            description="Complete a few focus sessions and this page fills in with trends, peak hours, distraction patterns, and mood correlations."
          />
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Analytics"
        subtitle="Everything here is computed locally from your own session history."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => exportSessionsCsv(sessions)}>
              <Sheet className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void exportJson()}>
              <FileJson className="h-3.5 w-3.5" />
              JSON
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                void exportPdf(sessions, distractions, distractionCategories, PERIOD_LABEL[period])
              }
            >
              <FileText className="h-3.5 w-3.5" />
              PDF
            </Button>
          </div>
        }
      />

      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)} className="mb-4">
        <TabsList>
          <TabsTrigger value="day">Day</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="year">Year</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Focus time"
          value={formatDuration(summary.focusMs)}
          hint={PERIOD_LABEL[period]}
          icon={Clock}
          tone="accent"
        />
        <StatCard
          label="Sessions"
          value={`${summary.sessions}`}
          hint={`${Math.round(summary.completionRate * 100)}% completed`}
          icon={Target}
          progress={summary.completionRate}
          tone="break"
        />
        <StatCard
          label="Avg session"
          value={summary.avgSessionMs > 0 ? formatDuration(summary.avgSessionMs) : '—'}
          hint={
            summary.avgProductivity
              ? `Rated ${summary.avgProductivity.toFixed(1)}/5`
              : 'Not yet rated'
          }
          icon={TrendingUp}
        />
        <StatCard
          label="Distractions"
          value={`${summary.distractions}`}
          hint={
            summary.sessions > 0
              ? `${(summary.distractions / summary.sessions).toFixed(1)} per session`
              : '—'
          }
          icon={Zap}
          tone="warn"
        />
      </div>

      {/* Focus timeline */}
      <Card className="mt-4">
        <CardTitle>Focus over time</CardTitle>
        <CardDescription>Completed focus per day.</CardDescription>
        <div className="mt-4 h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="focusFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'rgb(var(--subtle))' }}
                axisLine={false}
                tickLine={false}
                minTickGap={20}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'rgb(var(--subtle))' }}
                axisLine={false}
                tickLine={false}
                width={Y_AXIS_WIDTH}
                tickFormatter={hourTick}
                ticks={focusScale?.ticks}
                domain={focusScale?.domain ?? [0, 'auto']}
              />
              <RTooltip content={<ChartTooltip unit="h" />} />
              <Area
                type="monotone"
                dataKey="hours"
                stroke="rgb(var(--accent))"
                strokeWidth={2}
                fill="url(#focusFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Peak hours */}
        <Card>
          <CardTitle>When you focus best</CardTitle>
          <CardDescription>
            {peakHour && peakHour.minutes > 0
              ? `Your strongest hour is ${peakHour.label}.`
              : 'Not enough data for this period yet.'}
          </CardDescription>
          <div className="mt-4 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'rgb(var(--subtle))' }}
                  axisLine={false}
                  tickLine={false}
                  interval={2}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'rgb(var(--subtle))' }}
                  axisLine={false}
                  tickLine={false}
                  width={Y_AXIS_WIDTH}
                  tickFormatter={hourlyTick}
                  allowDecimals={false}
                />
                <RTooltip content={<ChartTooltip unit=" min" />} />
                <Bar dataKey="minutes" radius={[3, 3, 0, 0]}>
                  {hourly.map((h) => (
                    <Cell
                      key={h.hour}
                      fill="rgb(var(--accent))"
                      fillOpacity={0.25 + h.intensity * 0.75}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <MoodInsights sessions={sessions} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <CategoryBreakdown sessions={sessions} categories={categories} />

        <DistractionReport distractions={distractions} categories={distractionCategories} />

        <Card>
          <CardTitle>Sessions per day</CardTitle>
          <CardDescription>Completed focus sessions across the period.</CardDescription>
          <div className="mt-4 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'rgb(var(--subtle))' }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'rgb(var(--subtle))' }}
                  axisLine={false}
                  tickLine={false}
                  width={Y_AXIS_WIDTH}
                  allowDecimals={false}
                />
                <RTooltip content={<ChartTooltip />} />
                <Bar dataKey="sessions" fill="rgb(var(--break))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Contribution heatmap — always full history, regardless of period */}
      <Card className="mt-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Focus history</CardTitle>
            <CardDescription>
              Every day you've focused, up to a year back. Darker means deeper.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => exportSessionsCsv(allSessions)}>
            <Download className="h-3.5 w-3.5" />
            Full export
          </Button>
        </div>
        <div className="mt-4">
          <Heatmap stats={allStats} weeks={Math.min(53, Math.ceil((Date.now() - (allSessions[0]?.startedAt ?? Date.now())) / (DAY * 7)) + 6)} />
        </div>
      </Card>
    </PageContainer>
  );
}

interface TooltipPayload {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}

/** The hover card shared by every chart on this page. */
function ChartTooltip({ active, payload, label, unit = '' }: TooltipPayload & { unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-elevated px-3 py-2 shadow-lift">
      <p className="text-[11px] font-medium text-subtle">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="tabular text-[13px] font-medium capitalize" style={{ color: p.color }}>
          {p.value}
          {unit} {p.name}
        </p>
      ))}
    </div>
  );
}
