import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckSquare, ListFilter, Plus } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Card,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/primitives';
import { TaskRow } from './TaskRow';
import { TaskDialog } from './TaskDialog';
import { MoodCheckDialog } from '@/features/focus/MoodCheckDialog';
import { useTaskStore } from '@/store/useTaskStore';
import { useStatsStore } from '@/store/useStatsStore';
import { useStartSession } from '@/hooks/useStartSession';
import { useShell } from '@/app/shell';
import type { Task } from '@/types';
import { pluralize } from '@/lib/utils';

type Filter = 'open' | 'done' | 'all';

/**
 * The visible ids with `movedId` lifted out and dropped where `targetId` sits,
 * or null if either is not on screen.
 */
export function moveWithin(ids: string[], movedId: string, targetId: string): string[] | null {
  const from = ids.indexOf(movedId);
  const to = ids.indexOf(targetId);
  if (from === -1 || to === -1) return null;
  const next = [...ids];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/**
 * Folds a rearrangement of the on-screen rows back into the full task order.
 *
 * The order written to the database is global, but a drag only ever rearranges
 * what a filter left on screen. Handing those ids to `reorder` on their own
 * renumbers them 0..n-1 and collides with everything the filter is hiding —
 * reordering two tasks inside one category sent that whole category jumping to
 * the top of the unfiltered list, and left two tasks sharing each order number.
 * Slotting the new arrangement back into the positions those rows already
 * occupied keeps every hidden task exactly where it was.
 */
export function applyToFullOrder(fullIds: string[], rearrangedVisible: string[]): string[] {
  const onScreen = new Set(rearrangedVisible);
  const out = [...fullIds];
  let next = 0;
  for (let i = 0; i < out.length; i += 1) {
    if (onScreen.has(out[i])) {
      out[i] = rearrangedVisible[next];
      next += 1;
    }
  }
  return out;
}

/** The task board: filter by state and category, reorder by dragging, and start a focus session on any row. */
export function TasksPage() {
  const { openDeepFocus } = useShell();
  const tasks = useTaskStore((s) => s.tasks);
  const categories = useTaskStore((s) => s.categories);
  const reorder = useTaskStore((s) => s.reorder);
  const sessions = useStatsStore((s) => s.sessions);

  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [filter, setFilter] = useState<Filter>('open');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { begin, moodOpen, setMoodOpen, confirmMood, pendingTaskTitle } =
    useStartSession(openDeepFocus);

  // Support ⌘K → "New task", which lands here with ?new=1.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditing(null);
      setDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visible = useMemo(() => {
    let list = tasks.filter((t) => t.status !== 'archived');
    if (filter === 'open') list = list.filter((t) => t.status !== 'done');
    if (filter === 'done') list = list.filter((t) => t.status === 'done');
    if (categoryFilter !== 'all') list = list.filter((t) => t.categoryId === categoryFilter);
    return list;
  }, [tasks, filter, categoryFilter]);

  const openCount = tasks.filter((t) => t.status === 'todo' || t.status === 'active').length;

  /** Commits a drag: moves the dragged task to where it was dropped and persists the new order. */
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const next = moveWithin(
      visible.map((t) => t.id),
      String(active.id),
      String(over.id),
    );
    if (!next) return;
    void reorder(applyToFullOrder(tasks.map((t) => t.id), next));
  };

  return (
    <PageContainer>
      <PageHeader
        title="Tasks"
        subtitle={
          openCount > 0
            ? `${openCount} open ${pluralize(openCount, 'task')} · drag to reorder`
            : 'Everything is clear.'
        }
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            New task
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="done">Done</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {categories.length > 0 && (
          <div className="w-[180px]">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <span className="flex items-center gap-2">
                  <ListFilter className="h-3.5 w-3.5 text-subtle" />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        {visible.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title={filter === 'done' ? 'Nothing completed yet' : 'No tasks here'}
            description={
              filter === 'done'
                ? 'Finished tasks will collect here.'
                : 'Add what you are working on so focus sessions attach to real work and estimates get smarter.'
            }
            action={
              filter !== 'done' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add your first task
                </Button>
              )
            }
          />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={visible.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-border">
                <AnimatePresence initial={false}>
                  {visible.map((task) => (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      <TaskRow
                        task={task}
                        sessions={sessions}
                        categories={categories}
                        onEdit={() => {
                          setEditing(task);
                          setDialogOpen(true);
                        }}
                        onStart={() => begin(task.id, task.title)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </Card>

      <TaskDialog open={dialogOpen} onOpenChange={setDialogOpen} task={editing} />

      <MoodCheckDialog
        open={moodOpen}
        onOpenChange={setMoodOpen}
        onConfirm={confirmMood}
        taskTitle={pendingTaskTitle}
      />
    </PageContainer>
  );
}
