import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Award, Flame, Hourglass, Lock, ShieldCheck, Sparkles, Trophy } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { DynamicIcon } from '@/components/DynamicIcon';
import { Badge, Card } from '@/components/ui/primitives';
import { useStatsStore } from '@/store/useStatsStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { buildContext, evaluateAchievements, levelForXp } from '@/engine/achievements';
import { computeStreak } from '@/engine/analytics';
import { cn, formatDuration, pluralize } from '@/lib/utils';

const TIER_STYLE = {
  bronze: 'text-[#c8874a] bg-[#c8874a]/12 border-[#c8874a]/25',
  silver: 'text-[#9fb0c4] bg-[#9fb0c4]/12 border-[#9fb0c4]/25',
  gold: 'text-[#e0b040] bg-[#e0b040]/12 border-[#e0b040]/25',
  platinum: 'text-accent bg-accent/12 border-accent/25',
} as const;

/** The progress screen: current level and XP, lifetime stats, badges earned, and the ones still in reach ordered by how close they are. */
export function AchievementsPage() {
  const sessions = useStatsStore((s) => s.sessions);
  const settings = useSettingsStore((s) => s.settings);

  const ctx = useMemo(
    () => buildContext(sessions, settings.dailyGoalSessions),
    [sessions, settings.dailyGoalSessions],
  );
  const achievements = useMemo(() => evaluateAchievements(ctx), [ctx]);
  const level = useMemo(() => levelForXp(settings.xp), [settings.xp]);
  const streak = useMemo(() => computeStreak(sessions), [sessions]);

  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);

  return (
    <PageContainer>
      <PageHeader
        title="Progress"
        subtitle="Momentum you've built, and what's within reach."
      />

      {/* Level banner */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="lit relative overflow-hidden">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative grid h-20 w-20 shrink-0 place-items-center">
              <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
                <circle cx="50" cy="50" r="44" fill="none" strokeWidth="7" className="stroke-subtle/15" />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  strokeWidth="7"
                  strokeLinecap="round"
                  className="stroke-accent"
                  strokeDasharray={2 * Math.PI * 44}
                  initial={{ strokeDashoffset: 2 * Math.PI * 44 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 44 * (1 - level.pct) }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
              </svg>
              <div className="text-center leading-none">
                <p className="text-[10px] font-medium uppercase tracking-wide text-subtle">Level</p>
                <p className="tabular text-2xl font-semibold">{level.level}</p>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight">{levelTitle(level.level)}</h2>
                <Badge tone="accent">{settings.xp.toLocaleString()} XP</Badge>
              </div>
              <p className="mt-1 text-[13px] text-muted">
                {level.needed - level.into} XP to level {level.level + 1} — roughly{' '}
                {Math.ceil((level.needed - level.into) / 50)} more{' '}
                {pluralize(Math.ceil((level.needed - level.into) / 50), 'session')}.
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-subtle/20">
                <motion.div
                  className="h-full rounded-full bg-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${level.pct * 100}%` }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Badges earned"
          value={`${unlocked.length}`}
          hint={`of ${achievements.length}`}
          icon={Trophy}
          tone="accent"
          progress={unlocked.length / achievements.length}
        />
        <StatCard
          label="Current streak"
          value={`${streak.current}`}
          hint={`Best: ${streak.longest} ${pluralize(streak.longest, 'day')}`}
          icon={Flame}
          tone="warn"
        />
        <StatCard
          label="Total focus"
          value={formatDuration(ctx.totalFocusMs)}
          hint={`${ctx.completedSessions} ${pluralize(ctx.completedSessions, 'session')}`}
          icon={Hourglass}
          tone="break"
        />
        <StatCard
          label="Clean sessions"
          value={`${ctx.zeroDistractionSessions}`}
          hint="No distractions logged"
          icon={ShieldCheck}
        />
      </div>

      {unlocked.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Sparkles className="h-4 w-4 text-accent" />
            Earned
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unlocked.map((a, i) => (
              <AchievementCard key={a.id} achievement={a} index={i} />
            ))}
          </div>
        </section>
      )}

      {locked.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Lock className="h-4 w-4 text-subtle" />
            In progress
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {locked
              .sort((a, b) => b.progressValue - a.progressValue)
              .map((a, i) => (
                <AchievementCard key={a.id} achievement={a} index={i} />
              ))}
          </div>
        </section>
      )}
    </PageContainer>
  );
}

/** One badge. Earned, it is shown in its tier colour; unearned, dimmed with a bar showing how far along it is. */
function AchievementCard({
  achievement,
  index,
}: {
  achievement: ReturnType<typeof evaluateAchievements>[number];
  index: number;
}) {
  const { unlocked, progressValue, tier } = achievement;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
    >
      <Card className={cn('h-full p-4 transition-all', !unlocked && 'opacity-70')}>
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-xl border',
              unlocked ? TIER_STYLE[tier] : 'border-border bg-elevated text-subtle',
            )}
          >
            <DynamicIcon name={achievement.icon} className="h-4 w-4" fallback={Award} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-[13px] font-semibold">{achievement.title}</p>
              {unlocked && <Badge tone="accent" className="shrink-0 capitalize">{tier}</Badge>}
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">{achievement.description}</p>

            {!unlocked && (
              <>
                <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-subtle/20">
                  <div
                    className="h-full rounded-full bg-accent/70 transition-all duration-500"
                    style={{ width: `${progressValue * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-subtle">
                  {Math.round(progressValue * 100)}% of {achievement.goalLabel}
                </p>
              </>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

/** The title that goes with a level — the reward that isn't a number. */
function levelTitle(level: number): string {
  if (level >= 25) return 'Focus Legend';
  if (level >= 18) return 'Deep Work Master';
  if (level >= 12) return 'Flow Architect';
  if (level >= 8) return 'Focused Operator';
  if (level >= 5) return 'Steady Builder';
  if (level >= 3) return 'Finding Your Rhythm';
  return 'Getting Started';
}
