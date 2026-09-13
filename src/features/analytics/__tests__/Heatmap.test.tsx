import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Heatmap } from '../Heatmap';
import { heatmapTooltipText } from '../heatmapLabels';
import { heatmapData, toDayStats } from '@/engine/analytics';
import { DAY, MINUTE, startOfDay } from '@/lib/utils';
import type { Session } from '@/types';

/** A finished focus session on the day `daysAgo` before today. */
const sessionOn = (daysAgo: number, minutes: number, id: string): Session => {
  const startedAt = startOfDay() - daysAgo * DAY + 10 * 3_600_000;
  return {
    id,
    type: 'focus',
    plannedMs: minutes * MINUTE,
    actualMs: minutes * MINUTE,
    startedAt,
    endedAt: startedAt + minutes * MINUTE,
    completed: true,
    distractionCount: 0,
    pausedMs: 0,
  };
};

const STATS = toDayStats([sessionOn(0, 75, 'a'), sessionOn(0, 25, 'b'), sessionOn(8, 25, 'c')], []);
const WEEKS = 4;

/** The one cell that is currently in the tab order. */
function tabStop(grid: HTMLElement) {
  const stops = within(grid)
    .getAllByRole('gridcell')
    .filter((cell) => cell.getAttribute('tabindex') === '0');
  expect(stops).toHaveLength(1);
  return stops[0];
}

const position = (element: Element) => ({
  row: Number((element as HTMLElement).dataset.row),
  col: Number((element as HTMLElement).dataset.col),
});

describe('Heatmap', () => {
  it('is a named grid with a row for each weekday and a summary to go with it', () => {
    render(<Heatmap stats={STATS} weeks={WEEKS} />);

    const grid = screen.getByRole('grid', { name: 'Focus history' });
    expect(within(grid).getAllByRole('row')).toHaveLength(7);
    expect(grid).toHaveAccessibleDescription(/Focus on 2 of the last 28 days/);
  });

  it('labels every day, including the ones with nothing on them', () => {
    render(<Heatmap stats={STATS} weeks={WEEKS} />);
    const grid = screen.getByRole('grid', { name: 'Focus history' });

    // These squares used to carry their meaning only in a hover tooltip.
    const labelled = within(grid)
      .getAllByRole('gridcell')
      .filter((cell) => cell.getAttribute('aria-label'));
    expect(labelled).toHaveLength(28);

    expect(labelled.some((cell) => /1h 40m of focus, 2 sessions finished/.test(cell.getAttribute('aria-label')!))).toBe(true);
    expect(labelled.filter((cell) => /: no focus$/.test(cell.getAttribute('aria-label')!))).toHaveLength(26);
  });

  it('puts a single tab stop on today', async () => {
    const user = userEvent.setup();
    render(<Heatmap stats={STATS} weeks={WEEKS} />);
    const grid = screen.getByRole('grid', { name: 'Focus history' });

    await user.tab();

    expect(document.activeElement).toBe(tabStop(grid));
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/1h 40m of focus/);
  });

  it('moves between days with the arrow keys, and the tab stop moves too', async () => {
    const user = userEvent.setup();
    render(<Heatmap stats={STATS} weeks={WEEKS} />);
    const grid = screen.getByRole('grid', { name: 'Focus history' });
    await user.tab();
    const start = position(document.activeElement!);

    // Left is the same weekday a week earlier.
    await user.keyboard('{ArrowLeft}');
    const weekBefore = position(document.activeElement!);
    expect(weekBefore).toEqual({ row: start.row, col: start.col - 1 });
    expect(position(tabStop(grid))).toEqual(weekBefore);

    // Up and down move a day within the week.
    const vertical = weekBefore.row > 0 ? '{ArrowUp}' : '{ArrowDown}';
    await user.keyboard(vertical);
    expect(position(document.activeElement!)).toEqual({
      row: weekBefore.row + (weekBefore.row > 0 ? -1 : 1),
      col: weekBefore.col,
    });

    // Ctrl+End returns to today.
    await user.keyboard('{Control>}{End}{/Control}');
    expect(position(document.activeElement!)).toEqual(start);
  });

  it('stays put rather than stepping off the edge of the data', async () => {
    const user = userEvent.setup();
    render(<Heatmap stats={STATS} weeks={WEEKS} />);
    await user.tab();
    const today = position(document.activeElement!);

    // Nothing lies after today.
    await user.keyboard('{ArrowRight}');
    expect(position(document.activeElement!)).toEqual(today);
  });

  it('shows one floating label, and moves it rather than making another', async () => {
    const user = userEvent.setup();
    const { container } = render(<Heatmap stats={STATS} weeks={WEEKS} />);
    const cells = heatmapData(STATS, WEEKS);

    await user.tab();
    let tips = container.querySelectorAll('[data-heatmap-tooltip]');
    expect(tips).toHaveLength(1);
    expect(tips[0]).toHaveTextContent(heatmapTooltipText(cells[cells.length - 1]));
    // The label repeats what the focused day already says, so it is hidden from assistive technology.
    expect(tips[0]).toHaveAttribute('aria-hidden', 'true');

    await user.keyboard('{ArrowLeft}');
    tips = container.querySelectorAll('[data-heatmap-tooltip]');
    expect(tips).toHaveLength(1);
    expect(tips[0]).toHaveTextContent(heatmapTooltipText(cells[cells.length - 8]));
  });
});
