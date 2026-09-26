import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Coffee, Target, Trash2, Zap } from 'lucide-react';
import type { Session } from '@/types';
import { Card, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { useStatsStore } from '@/store/useStatsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { deleteSession } from '@/store/sessionHistory';
import { formatDuration, pluralize, relativeTime } from '@/lib/utils';

type FeedItem = {
  id: string;
  at: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  tone: string;
  /** Set for session entries, which can be deleted; distractions go with their session. */
  session?: Session;
};

/** A merged, newest-first timeline of recent sessions and distractions — the day's story in one column. */
export function ActivityFeed() {
  const sessions = useStatsStore((s) => s.sessions);
  const distractions = useStatsStore((s) => s.distractions);
  const distractionCategories = useTaskStore((s) => s.distractionCategories);
  const [confirming, setConfirming] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      session: s,
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

  /** Spells out everything that goes with the session, so the confirmation is an informed one. */
  const consequence = (session: Session) => {
    const logged = distractions.filter((d) => d.sessionId === session.id).length;
    const parts = ['It will be removed from your history'];
    if (logged > 0) parts.push(`along with its ${logged} ${pluralize(logged, 'distraction')}`);
    const earned = session.type === 'focus' && session.completed;
    return `${parts.join(' ')}${earned ? ', and the XP and task credit it earned will be taken back' : ''}. This can’t be undone.`;
  };

  const confirmDelete = async () => {
    if (!confirming) return;
    setDeleting(true);
    try {
      await deleteSession(confirming.id);
    } finally {
      setDeleting(false);
      setConfirming(null);
    }
  };

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
              <li key={item.id} className="group flex items-start gap-3 px-5 py-3">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${item.tone}`}>
                  <item.icon className="h-3 w-3" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{item.title}</p>
                  <p className="truncate text-[11px] text-subtle">{item.detail}</p>
                </div>
                <span className="shrink-0 text-[11px] text-subtle">{relativeTime(item.at)}</span>
                {item.session && (
                  // Always visible on touch screens, which have no hover to reveal it.
                  <button
                    type="button"
                    onClick={() => setConfirming(item.session!)}
                    aria-label="Delete this session"
                    title="Delete this session"
                    className="-my-1 shrink-0 rounded-md p-1 text-subtle transition-opacity hover:text-danger focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Delete this session?</DialogTitle>
          <DialogDescription>{confirming ? consequence(confirming) : ''}</DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()} disabled={deleting}>
              Delete session
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
