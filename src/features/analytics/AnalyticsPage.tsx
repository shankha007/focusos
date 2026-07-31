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

export function AnalyticsPage() {
  const allSessions = useStatsStore((s) => s.sessions);
  const allDistractions = useStatsStore((s) => s.distractions);
  const distractionCategories = useTaskStore((s) => s.distractionCategories);
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
        <CardDescription>Hours of completed focus per day.</CardDescription>
        <div className="mt-4 h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
                width={44}
                unit="h"
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
              <BarChart data={hourly} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
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
                  width={44}
                  unit="m"
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
        <DistractionReport distractions={distractions} categories={distractionCategories} />

        <Card>
          <CardTitle>Sessions per day</CardTitle>
          <CardDescription>Completed focus sessions across the period.</CardDescription>
          <div className="mt-4 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
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
                  width={44}
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
              Every day you've focused, going back a year. Darker means deeper.
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
