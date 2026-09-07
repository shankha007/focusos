import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Clock,
  Flame,
  Gauge,
  Play,
  Plus,
  Target,
} from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, EmptyState } from '@/components/ui/primitives';
import { MoodCheckDialog } from '@/features/focus/MoodCheckDialog';
import { CurrentSessionCard } from './CurrentSessionCard';
import { WaterBreakCard } from '@/features/focus/WaterBreakCard';
import { DailyPlanCard } from './DailyPlanCard';
import { ActivityFeed } from './ActivityFeed';
import { ReflectionCard } from './ReflectionCard';
import { useStatsStore } from '@/store/useStatsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useStartSession } from '@/hooks/useStartSession';
import { useShell } from '@/app/shell';
import { computeFocusScore, computeStreak, focusOnly, focusTimeMs } from '@/engine/analytics';
import { formatDuration, pluralize, startOfDay } from '@/lib/utils';

/** The landing screen: today's focus score and headline stats, the timer, the suggested plan, the daily reflection, and recent activity. */
export function DashboardPage() {
  const { openDeepFocus } = useShell();
  const sessions = useStatsStore((s) => s.sessions);
  const distractions = useStatsStore((s) => s.distractions);
  const tasks = useTaskStore((s) => s.tasks);
  const settings = useSettingsStore((s) => s.settings);
  const { begin, moodOpen, setMoodOpen, confirmMood, pendingTaskTitle } =
    useStartSession(openDeepFocus);

  const today = useMemo(() => {
    const from = startOfDay();
    const todaySessions = sessions.filter((s) => s.startedAt >= from);
    const todayDistractions = distractions.filter((d) => d.at >= from);
    const completedFocus = focusOnly(todaySessions).filter((s) => s.completed);

    return {
      sessions: todaySessions,
      distractions: todayDistractions,
      completed: completedFocus.length,
      // Every screen reads focus time the same way now — see focusTimeMs.
      focusMs: focusTimeMs(todaySessions),
      score: computeFocusScore(todaySessions, todayDistractions, settings.dailyGoalSessions),
    };
  }, [sessions, distractions, settings.dailyGoalSessions]);

  const streak = useMemo(() => computeStreak(sessions), [sessions]);

  const openTasks = tasks.filter((t) => t.status === 'todo' || t.status === 'active');
  const nextTask = openTasks[0];

  const greeting = getGreeting();

  return (
    <PageContainer>
      <PageHeader
        title={`${greeting}.`}
        subtitle={
          today.completed > 0
            ? `${today.completed} ${pluralize(today.completed, 'session')} done today — ${formatDuration(today.focusMs)} of focus.`
            : 'Nothing logged yet today. One session is enough to start.'
        }
        action={
          <Button onClick={() => begin(nextTask?.id ?? null, nextTask?.title ?? null)}>
            <Play className="h-4 w-4" />
            Start focusing
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Sessions today"
          value={`${today.completed}`}
          hint={`Goal: ${settings.dailyGoalSessions}`}
          icon={Target}
          tone="accent"
          progress={today.completed / settings.dailyGoalSessions}
          delay={0}
        />
        <StatCard
          label="Focus time"
          value={formatDuration(today.focusMs)}
          hint={today.focusMs > 0 ? 'Deep work logged' : 'Not started'}
          icon={Clock}
          tone="break"
          delay={0.05}
        />
        <StatCard
          label="Current streak"
          value={`${streak.current}`}
          hint={
            streak.longest > streak.current ? `Best: ${streak.longest} days` : `${pluralize(streak.current, 'day')} running`
          }
          icon={Flame}
          tone="warn"
          delay={0.1}
        />
        <StatCard
          label="Focus score"
          value={`${today.score.score}`}
          hint={scoreLabel(today.score.score)}
          icon={Gauge}
          progress={today.score.score / 100}
          tone="accent"
          delay={0.15}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <CurrentSessionCard onOpenFocus={openDeepFocus} onStart={begin} />
          <WaterBreakCard />
          <DailyPlanCard onStart={begin} />
          <ReflectionCard />
        </div>

        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-0">
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                <CardTitle>Up next</CardTitle>
                <Link
                  to="/tasks"
                  className="flex items-center gap-1 text-[12px] text-muted transition-colors hover:text-fg"
                >
                  All tasks <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {openTasks.length === 0 ? (
                <EmptyState
                  icon={Plus}
                  title="No tasks yet"
                  description="Add what you're working on so sessions get attributed to real work."
                  action={
                    <Button size="sm" variant="secondary" asChild>
                      <Link to="/tasks">Add a task</Link>
                    </Button>
                  }
                  className="py-10"
                />
              ) : (
                <ul className="divide-y divide-border">
                  {openTasks.slice(0, 5).map((task) => (
                    <li key={task.id} className="group flex items-center gap-3 px-5 py-3">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: priorityColor(task.priority) }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{task.title}</p>
                        <p className="text-[11px] text-subtle">
                          {task.completedSessions}/{task.estimatedSessions} sessions
                        </p>
                      </div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={() => begin(task.id, task.title)}
                        aria-label={`Start focusing on ${task.title}`}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </motion.div>

          <ActivityFeed />
        </div>
      </div>

      <MoodCheckDialog
        open={moodOpen}
        onOpenChange={setMoodOpen}
        onConfirm={confirmMood}
        taskTitle={pendingTaskTitle}
      />
    </PageContainer>
  );
}

/** Time-of-day greeting for the page header. */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Working late';
}

/** Puts a word to the focus score, so the number reads as a judgement rather than a bare figure. */
function scoreLabel(score: number): string {
  if (score >= 85) return 'Exceptional day';
  if (score >= 65) return 'Strong day';
  if (score >= 40) return 'Building momentum';
  if (score > 0) return 'Just getting going';
  return 'Not started';
}

/** The dot colour for a task priority. Shared with the task list and dialog so the mapping is defined once. */
export function priorityColor(priority: string): string {
  switch (priority) {
    case 'urgent':
      return '#f87171';
    case 'high':
      return '#fb923c';
    case 'medium':
      return '#7886ff';
    default:
      return '#94a3b8';
  }
}
