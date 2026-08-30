import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bookmark } from 'lucide-react';
import type { Priority } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { DynamicIcon } from '@/components/DynamicIcon';
import { useTimerStore } from '@/store/useTimerStore';
import { useTaskStore } from '@/store/useTaskStore';
import { distractionsRepo } from '@/db/repositories';
import { cn, formatTime, pluralize } from '@/lib/utils';

/**
 * Closes the loop on parking. The urge to chase a thought mid-session only
 * quiets if the thought reliably comes back — so every parked note gets a
 * keep-or-drop decision the moment the session ends, and the kept ones land in
 * the task list rather than in a log the user never reads.
 *
 * Shown after the review dialog so a session ends with one prompt at a time.
 */
export function ParkedThoughtsDialog() {
  const parked = useTimerStore((s) => s.pendingParked);
  const pendingReview = useTimerStore((s) => s.pendingReview);
  const clearParked = useTimerStore((s) => s.clearParked);
  const distractionCategories = useTaskStore((s) => s.distractionCategories);
  const createTask = useTaskStore((s) => s.create);

  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Default to keeping everything: the user already decided these were worth
  // writing down, so dropping one should be the deliberate act.
  useEffect(() => {
    setKeep(new Set(parked.map((d) => d.id)));
  }, [parked]);

  // Wait for the review to be answered first.
  if (parked.length === 0 || pendingReview) return null;

  /** Flips one parked note between keep and drop. */
  const toggle = (id: string) => {
    setKeep((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** Turns every kept note into a task, marks all of them resolved so none resurfaces later, and closes. */
  const finish = async () => {
    setSaving(true);
    try {
      const taskIdById: Record<string, string> = {};

      for (const item of parked) {
        if (!keep.has(item.id) || !item.note) continue;
        const task = await createTask({
          title: item.note,
          priority: 'medium' as Priority,
          estimatedSessions: 1,
          notes: 'Parked during a focus session.',
        });
        taskIdById[item.id] = task.id;
      }

      // Every note is marked resolved, kept or not — an unanswered park would
      // resurface at the end of the next session.
      await distractionsRepo.resolveParked(
        parked.map((d) => d.id),
        taskIdById,
      );

      const kept = Object.keys(taskIdById).length;
      toast.success(
        kept === 0
          ? 'Cleared — nothing kept.'
          : `${kept} ${pluralize(kept, 'task')} added to your list.`,
      );
    } finally {
      setSaving(false);
      clearParked();
    }
  };

  const keptCount = keep.size;

  return (
    <Dialog open onOpenChange={(open) => !open && void finish()}>
      <DialogContent className="max-w-md">
        <div className="mb-1 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/12 text-accent">
            <Bookmark className="h-3.5 w-3.5" />
          </span>
          <DialogTitle>
            {parked.length} {pluralize(parked.length, 'thing')} you parked
          </DialogTitle>
        </div>
        <DialogDescription>
          Keep any? Anything you keep becomes a task. The rest stays in your distraction log.
        </DialogDescription>

        <div className="mt-5 space-y-2">
          {parked.map((item) => {
            const cat = distractionCategories.find((c) => c.id === item.categoryId);
            const checked = keep.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(item.id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all',
                  checked
                    ? 'border-accent bg-accent/10'
                    : 'border-border hover:border-subtle/40 hover:bg-elevated',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors',
                    checked ? 'border-accent bg-accent text-bg' : 'border-subtle/50',
                  )}
                >
                  {checked && (
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden>
                      <path
                        d="M2 6.5L4.5 9L10 3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[13px] font-medium">{item.note}</span>
                  <span className="mt-1 flex items-center gap-1.5 text-[11px] text-subtle">
                    {cat && (
                      <>
                        <span style={{ color: cat.color }} className="flex">
                          <DynamicIcon name={cat.icon} className="h-3 w-3" />
                        </span>
                        {cat.label}
                        <span aria-hidden>·</span>
                      </>
                    )}
                    {formatTime(item.at)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setKeep(keptCount === parked.length ? new Set() : new Set(parked.map((d) => d.id)))}
          >
            {keptCount === parked.length ? 'Keep none' : 'Keep all'}
          </Button>
          <Button disabled={saving} onClick={() => void finish()}>
            {keptCount === 0
              ? 'Discard all'
              : `Keep ${keptCount} ${pluralize(keptCount, 'task')}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
