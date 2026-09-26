import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, CheckCircle2, Clock, Lightbulb, Zap } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/card';
import { useStatsStore } from '@/store/useStatsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { generateReflection } from '@/engine/reflection';
import { startOfDay } from '@/lib/utils';

/** The end-of-day debrief. Rule-based, so it works with no network. */
export function ReflectionCard() {
  const sessions = useStatsStore((s) => s.sessions);
  const distractions = useStatsStore((s) => s.distractions);
  const tasks = useTaskStore((s) => s.tasks);
  const distractionCategories = useTaskStore((s) => s.distractionCategories);
  const dailyGoal = useSettingsStore((s) => s.settings.dailyGoalSessions);

  const reflection = useMemo(() => {
    const from = startOfDay();
    return generateReflection(
      sessions.filter((s) => s.startedAt >= from),
      distractions.filter((d) => d.at >= from),
      distractionCategories,
      tasks,
      dailyGoal,
    );
  }, [sessions, distractions, distractionCategories, tasks, dailyGoal]);

  const toneClass = {
    quiet: 'text-subtle bg-elevated',
    building: 'text-warn bg-warn/12',
    strong: 'text-break bg-break/12',
    exceptional: 'text-accent bg-accent/12',
  }[reflection.tone];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <Card className="p-0">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <span className={`grid h-6 w-6 place-items-center rounded-lg ${toneClass}`}>
            <BookOpen className="h-3 w-3" />
          </span>
          <CardTitle>Daily reflection</CardTitle>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="text-[15px] font-medium tracking-tight">{reflection.headline}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{reflection.summary}</p>
          </div>

          {reflection.accomplishments.length > 0 && (
            <Section icon={CheckCircle2} title="What you got done">
              <ul className="space-y-1">
                {reflection.accomplishments.map((line, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-muted">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-subtle" />
                    {line}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {reflection.bestWindow && (
            <Section icon={Clock} title="Best focus window">
              <p className="text-[13px] leading-relaxed text-muted">{reflection.bestWindow}</p>
            </Section>
          )}

          {reflection.distractionNote && (
            <Section icon={Zap} title="Distractions">
              <p className="text-[13px] leading-relaxed text-muted">{reflection.distractionNote}</p>
            </Section>
          )}

          <Section icon={Lightbulb} title="For tomorrow">
            <ul className="space-y-1.5">
              {reflection.recommendations.map((rec, i) => (
                <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-muted">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
                  {rec}
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </Card>
    </motion.div>
  );
}

/** A labelled block within the reflection — accomplishments, best window, and so on. */
function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-border pt-3.5">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-subtle">
        <Icon className="h-3 w-3" />
        {title}
      </p>
      {children}
    </div>
  );
}
