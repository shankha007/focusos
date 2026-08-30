import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Activity, Coffee, Target, Zap } from 'lucide-react';
import { Card, CardTitle, EmptyState } from '@/components/ui/primitives';
import { useStatsStore } from '@/store/useStatsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { formatDuration, relativeTime } from '@/lib/utils';

type FeedItem = {
  id: string;
  at: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  tone: string;
};

/** A merged, newest-first timeline of recent sessions and distractions — the day's story in one column. */
export function ActivityFeed() {
  const sessions = useStatsStore((s) => s.sessions);
  const distractions = useStatsStore((s) => s.distractions);
  const distractionCategories = useTaskStore((s) => s.distractionCategories);

  const items = useMemo<FeedItem[]>(() => {
    const sessionItems: FeedItem[] = sessions.slice(-30).map((s) => ({
      id: s.id,
      at: s.endedAt,
      icon: s.type === 'focus' ? Target : Coffee,
      title:
        s.type === 'focus'
          ? s.completed
            ? `Completed ${formatDuration(s.actualMs)} focus`
            : `Ended focus early (${formatDuration(s.actualMs)})`
          : `${s.type === 'long-break' ? 'Long' : 'Short'} break`,
      detail: s.taskTitle ?? (s.type === 'focus' ? 'No task attached' : 'Recharged'),
      tone: s.type === 'focus' ? 'text-accent bg-accent/12' : 'text-break bg-break/12',
    }));

    const distractionItems: FeedItem[] = distractions.slice(-20).map((d) => {
      const cat = distractionCategories.find((c) => c.id === d.categoryId);
      return {
        id: d.id,
        at: d.at,
        icon: Zap,
        title: `Distracted — ${cat?.label ?? 'Other'}`,
        detail: d.note ?? 'Logged mid-session',
        tone: 'text-warn bg-warn/12',
      };
    });

    return [...sessionItems, ...distractionItems].sort((a, b) => b.at - a.at).slice(0, 8);
  }, [sessions, distractions, distractionCategories]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
      <Card className="p-0">
        <div className="border-b border-border px-5 py-3.5">
          <CardTitle>Recent activity</CardTitle>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Nothing here yet"
            description="Your sessions and distractions will show up as you go."
            className="py-10"
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-5 py-3">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${item.tone}`}>
                  <item.icon className="h-3 w-3" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{item.title}</p>
                  <p className="truncate text-[11px] text-subtle">{item.detail}</p>
                </div>
                <span className="shrink-0 text-[11px] text-subtle">{relativeTime(item.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </motion.div>
  );
}
