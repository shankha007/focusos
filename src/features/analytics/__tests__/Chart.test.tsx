import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Chart } from '../Chart';
import { monotonePath, niceTicks } from '../chartMath';

/**
 * Chart.tsx replaced Recharts, so these pin it to what Recharts drew: the tick
 * values were checked against Recharts' own getNiceTickValues for 86 inputs
 * before the dependency was removed, and the cases below are a sample of them.
 */

describe('niceTicks', () => {
  it.each([
    [0, false, [0, 1, 2, 3, 4]],
    [3, false, [0, 1, 2, 3, 4]],
    [7, false, [0, 2, 4, 6, 8]],
    [45, false, [0, 15, 30, 45, 60]],
    [0.9, true, [0, 0.25, 0.5, 0.75, 1]],
    // 0.25 / 0.05 is 5.000000000000001 in floating point; Recharts used exact
    // decimals and stepped by 25, not 30.
    [100, false, [0, 25, 50, 75, 100]],
  ])('max %s (decimals %s) -> %j', (max, allowDecimals, expected) => {
    expect(niceTicks(max, allowDecimals)).toEqual(expected);
  });
});

describe('monotonePath', () => {
  /** Every coordinate in the path comes as an x,y pair; these are the y halves. */
  const ys = (d: string) =>
    [...d.matchAll(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g)].map((m) => Number(m[0])).filter((_, i) => i % 2 === 1);

  it('keeps a run of empty days flat on the baseline instead of dipping below it', () => {
    const d = monotonePath([
      [0, 100],
      [10, 100],
      [20, 40],
      [30, 100],
      [40, 100],
    ]);
    for (const y of ys(d)) {
      expect(y).toBeGreaterThanOrEqual(40);
      expect(y).toBeLessThanOrEqual(100);
    }
  });

  it('draws a straight line through two points and a lone move for one', () => {
    expect(monotonePath([[0, 5], [10, 7]])).toBe('M0,5L10,7');
    expect(monotonePath([[3, 4]])).toBe('M3,4');
  });
});

describe('Chart', () => {
  beforeEach(() => {
    // jsdom lays nothing out, so give the chart a width to measure. The test
    // setup's ResizeObserver never reports, so this also proves the chart does
    // not wait for it before drawing.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
  });

  const rows = [
    { label: '9am', minutes: 30 },
    { label: '10am', minutes: 0 },
    { label: '11am', minutes: 45 },
    { label: '12pm', minutes: 10 },
  ];

  const renderBars = () =>
    render(
      <Chart
        kind="bar"
        height={200}
        ariaLabel="Minutes by hour"
        data={rows}
        label={(r) => r.label}
        value={(r) => r.minutes}
        color="red"
        allowDecimals={false}
        xInterval={1}
        tooltip={(r) => <p>{`${r.minutes} min at ${r.label}`}</p>}
      />,
    );

  it('draws one bar per non-empty value, on a labelled chart', () => {
    const { container } = renderBars();
    expect(screen.getByRole('img', { name: 'Minutes by hour' })).toBeInTheDocument();
    expect(container.querySelectorAll('path.chart-bar')).toHaveLength(3);
  });

  it('labels every other category when asked to, like a numeric interval', () => {
    renderBars();
    expect(screen.getByText('9am')).toBeInTheDocument();
    expect(screen.queryByText('10am')).toBeNull();
    expect(screen.getByText('11am')).toBeInTheDocument();
  });

  it('shows the hovered bar in the tooltip and hides it when the pointer leaves', () => {
    renderBars();
    const svg = screen.getByRole('img');
    // Plot runs from x=38 to x=296 across four bands of 64.5px; 200 is in the third.
    fireEvent.pointerMove(svg, { clientX: 200, clientY: 100 });
    expect(screen.getByText('45 min at 11am')).toBeInTheDocument();

    fireEvent.pointerLeave(svg);
    expect(screen.queryByText('45 min at 11am')).toBeNull();
  });
});
