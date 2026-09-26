import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from '../CommandPalette';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useTimerStore } from '@/store/useTimerStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { bootStores, resetApp } from '@/test/helpers';

function renderPalette(onOpenFocus = vi.fn()) {
  render(
    <TooltipProvider>
      <MemoryRouter>
        <CommandPalette open onOpenChange={() => {}} onOpenFocus={onOpenFocus} />
      </MemoryRouter>
    </TooltipProvider>,
  );
  return onOpenFocus;
}

describe('CommandPalette — starting a session', () => {
  beforeEach(async () => {
    await resetApp();
    await bootStores();
    // cmdk scrolls the highlighted item into view, which jsdom does not implement.
    if (!('scrollIntoView' in Element.prototype)) Object.assign(Element.prototype, { scrollIntoView() {} });
    // …and measures its list with ResizeObserver, which jsdom does not have either.
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it('asks the check-in before starting, like every other way in', async () => {
    const user = userEvent.setup();
    const onOpenFocus = renderPalette();

    await user.click(screen.getByText('Start focus session'));

    // It used to call startSession directly, so ⌘K sessions were never asked
    // and carried no mood at all.
    expect(await screen.findByRole('heading', { name: 'Before you start' })).toBeInTheDocument();
    expect(useTimerStore.getState().timer.status).toBe('idle');
    expect(onOpenFocus).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Skip' }));
    await vi.waitFor(() => expect(useTimerStore.getState().timer.status).toBe('running'));
    expect(onOpenFocus).toHaveBeenCalled();
  });

  it('asks it when focusing on a task from the palette, too', async () => {
    const user = userEvent.setup();
    await useTaskStore.getState().create({ title: 'Draft the proposal' });
    renderPalette();

    await user.click(screen.getByText('Focus on a task…'));
    await user.click(await screen.findByText('Draft the proposal'));

    expect(await screen.findByText(/Focusing on Draft the proposal\./)).toBeInTheDocument();
    expect(useTimerStore.getState().timer.status).toBe('idle');
    expect(useTimerStore.getState().taskTitle).toBe('Draft the proposal');
  });

  it('starts straight away when the check-in is switched off', async () => {
    const user = userEvent.setup();
    await useSettingsStore.getState().update({ askMoodBefore: false });
    const onOpenFocus = renderPalette();

    await user.click(screen.getByText('Start focus session'));

    await vi.waitFor(() => expect(useTimerStore.getState().timer.status).toBe('running'));
    expect(screen.queryByRole('heading', { name: 'Before you start' })).not.toBeInTheDocument();
    expect(onOpenFocus).toHaveBeenCalled();
  });
});
