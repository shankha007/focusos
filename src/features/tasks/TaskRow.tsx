import { useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, GripVertical, Pencil, Play, Trash2 } from 'lucide-react';
import type { Category, Session, Task } from '@/types';
import { Badge, Tooltip } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { useTaskStore } from '@/store/useTaskStore';
import { estimateTaskSessions } from '@/engine/adaptive';
import { cn, pluralize } from '@/lib/utils';
import { priorityColor } from '@/features/dashboard/DashboardPage';

export function TaskRow({
  task,
  sessions,
  categories,
  onEdit,
  onStart,
}: {
  task: Task;
  sessions: Session[];
  categories: Category[];
  onEdit: () => void;
  onStart: () => void;
}) {
  const toggleDone = useTaskStore((s) => s.toggleDone);
  const remove = useTaskStore((s) => s.remove);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const estimate = useMemo(() => estimateTaskSessions(task, sessions), [task, sessions]);
  const category = categories.find((c) => c.id === task.categoryId);
  const done = task.status === 'done';
  const pct = task.estimatedSessions > 0 ? task.completedSessions / task.estimatedSessions : 0;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group flex items-center gap-3 px-4 py-3 transition-colors sm:px-5',
        isDragging ? 'relative z-10 bg-elevated shadow-lift' : 'hover:bg-elevated/50',
        done && 'opacity-55',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-subtle opacity-0 transition-opacity hover:text-muted group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
        aria-label={`Reorder ${task.title}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <button
        onClick={() => void toggleDone(task.id)}
        className={cn(
          'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border transition-all',
          done ? 'border-accent bg-accent text-accent-fg' : 'border-subtle/50 hover:border-accent',
        )}
        aria-label={done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
        aria-pressed={done}
      >
        {done && <Check className="h-3 w-3" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn('truncate text-[13px] font-medium', done && 'line-through')}>
            {task.title}
          </p>
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: priorityColor(task.priority) }}
            title={`${task.priority} priority`}
          />
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Tooltip content={estimate.reason}>
            <span className="tabular text-[11px] text-subtle">
              {task.completedSessions}/{task.estimatedSessions} {pluralize(task.estimatedSessions, 'session')}
            </span>
          </Tooltip>

          {category && (
            <span className="flex items-center gap-1 text-[11px] text-subtle">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.color }} />
              {category.name}
            </span>
          )}

          {task.tags.map((tag) => (
            <Badge key={tag} tone="muted" className="px-1.5 py-0">
              {tag}
            </Badge>
          ))}
        </div>

        {!done && task.estimatedSessions > 0 && (
          <div className="mt-2 h-0.5 w-full max-w-[220px] overflow-hidden rounded-full bg-subtle/20">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${Math.min(100, pct * 100)}%` }}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {!done && (
          <Tooltip content="Start a focus session">
            <Button size="icon-sm" variant="ghost" onClick={onStart} aria-label={`Focus on ${task.title}`}>
              <Play className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        )}
        <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label={`Edit ${task.title}`}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => void remove(task.id)}
          aria-label={`Delete ${task.title}`}
          className="hover:text-danger"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}
