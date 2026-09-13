import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskRow } from '../TaskRow';
import { TooltipProvider } from '@/components/ui/primitives';
import { useTaskStore } from '@/store/useTaskStore';
import { db } from '@/db/schema';
import type { Task } from '@/types';
import { bootStores, resetApp } from '@/test/helpers';

function renderRow(task: Task) {
  return render(
    <TooltipProvider>
      <DndContext>
        <SortableContext items={[task.id]}>
          <ul>
            <TaskRow task={task} sessions={[]} categories={[]} onEdit={() => {}} onStart={() => {}} />
          </ul>
        </SortableContext>
      </DndContext>
    </TooltipProvider>,
  );
}

const current = (id: string) => useTaskStore.getState().tasks.find((t) => t.id === id)!;

describe('archiving tasks', () => {
  beforeEach(async () => {
    await resetApp();
    await bootStores();
  });

  it('archives a finished task from its row', async () => {
    const user = userEvent.setup();
    const task = await useTaskStore.getState().create({ title: 'Ship the release notes' });
    await useTaskStore.getState().toggleDone(task.id);
    renderRow(current(task.id));

    await user.click(screen.getByRole('button', { name: 'Archive Ship the release notes' }));

    await vi.waitFor(async () => expect((await db.tasks.get(task.id))?.status).toBe('archived'));
  });

  it('only offers archiving once a task is finished', async () => {
    const task = await useTaskStore.getState().create({ title: 'Still in progress' });
    renderRow(current(task.id));
    expect(screen.queryByRole('button', { name: /^Archive/ })).not.toBeInTheDocument();
  });

  it('restores an archived task, and will not let the checkbox quietly un-archive it', async () => {
    const user = userEvent.setup();
    const task = await useTaskStore.getState().create({ title: 'Last year’s plan' });
    await useTaskStore.getState().update(task.id, { status: 'archived' });
    renderRow(current(task.id));

    expect(screen.getByRole('button', { name: 'Last year’s plan is archived' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Restore Last year’s plan' }));
    await vi.waitFor(async () => expect((await db.tasks.get(task.id))?.status).toBe('done'));
  });

  it('archives every finished task at once, leaving open work alone', async () => {
    const open = await useTaskStore.getState().create({ title: 'Open' });
    const doneA = await useTaskStore.getState().create({ title: 'Done A' });
    const doneB = await useTaskStore.getState().create({ title: 'Done B' });
    await useTaskStore.getState().toggleDone(doneA.id);
    await useTaskStore.getState().toggleDone(doneB.id);

    await useTaskStore.getState().archiveAllDone();

    expect(current(doneA.id).status).toBe('archived');
    expect(current(doneB.id).status).toBe('archived');
    expect(current(open.id).status).toBe('todo');
  });
});
