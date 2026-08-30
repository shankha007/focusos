import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { Priority, Task } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { useTaskStore } from '@/store/useTaskStore';
import { cn, clamp } from '@/lib/utils';
import { priorityColor } from '@/features/dashboard/DashboardPage';

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

/** The create-and-edit form for a task. Pass a `task` to edit it, or null to create a new one; the fields reset from that every time the dialog opens. */
export function TaskDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: Task | null;
}) {
  const categories = useTaskStore((s) => s.categories);
  const create = useTaskStore((s) => s.create);
  const update = useTaskStore((s) => s.update);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [categoryId, setCategoryId] = useState<string>('none');
  const [estimate, setEstimate] = useState(1);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? '');
    setNotes(task?.notes ?? '');
    setPriority(task?.priority ?? 'medium');
    setCategoryId(task?.categoryId ?? 'none');
    setEstimate(task?.estimatedSessions ?? 1);
    setTagInput(task?.tags.join(', ') ?? '');
  }, [open, task]);

  /** Validates and writes the form — updating the task being edited, or creating a new one — then closes. A blank title is rejected silently. */
  const save = async () => {
    if (!title.trim()) return;
    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title: title.trim(),
      notes: notes.trim() || undefined,
      priority,
      categoryId: categoryId === 'none' ? undefined : categoryId,
      estimatedSessions: estimate,
      tags,
    };

    if (task) await update(task.id, payload);
    else await create(payload);

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>{task ? 'Edit task' : 'New task'}</DialogTitle>
        <DialogDescription>
          A specific title focuses better than a vague one — "Draft intro section" beats "writing".
        </DialogDescription>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="task-title" className="mb-1.5 block text-[13px] font-medium">
              Title
            </label>
            <Input
              id="task-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What are you working on?"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && title.trim()) void save();
              }}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium">Priority</label>
            <div className="grid grid-cols-4 gap-1.5">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-xl border py-2 text-[12px] font-medium capitalize transition-all',
                    priority === p
                      ? 'border-accent bg-accent/10 text-fg'
                      : 'border-border text-muted hover:border-subtle/40',
                  )}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: priorityColor(p) }}
                  />
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium">Category</label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium">Est. sessions</label>
              <div className="flex h-9 items-center justify-between rounded-xl border border-border bg-bg px-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setEstimate((n) => clamp(n - 1, 1, 20))}
                  aria-label="Decrease estimate"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="tabular text-sm font-medium">{estimate}</span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setEstimate((n) => clamp(n + 1, 1, 20))}
                  aria-label="Increase estimate"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="task-tags" className="mb-1.5 block text-[13px] font-medium">
              Tags
            </label>
            <Input
              id="task-tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="comma, separated"
            />
          </div>

          <div>
            <label htmlFor="task-notes" className="mb-1.5 block text-[13px] font-medium">
              Notes
            </label>
            <Textarea
              id="task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything you need to remember before starting."
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!title.trim()} onClick={() => void save()}>
            {task ? 'Save changes' : 'Create task'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
