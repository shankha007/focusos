import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { DayStat } from '@/types';
import { heatmapData } from '@/engine/analytics';
import {
  heatmapCellLabel,
  heatmapSummary,
  heatmapTooltipText,
  type HeatmapCell,
} from './heatmapLabels';

const LEVEL_CLASS = [
  'bg-subtle/12',
  'bg-accent/25',
  'bg-accent/45',
  'bg-accent/70',
  'bg-accent',
] as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A day's place in the grid: its weekday row (Monday first) and week column. */
interface Position {
  row: number;
  col: number;
}

/** Where the floating label sits, and for which day. */
interface Tip {
  cell: HeatmapCell;
  left: number;
  top: number;
  /** Top rows show their label below, where the scroll container will not clip it. */
  below: boolean;
}

/**
 * GitHub-style contribution grid, one cell per day, weeks running left to right.
 *
 * Built as an ARIA grid: seven rows (one per weekday), a single tab stop, and
 * the arrow keys to move between days. It used to be unfocusable squares whose
 * only description lived in a hover tooltip — a year of data that no keyboard
 * or screen-reader user could reach.
 *
 * It also used to wrap every cell in its own Radix tooltip: 371 tooltip roots,
 * each with its own context, state and listeners, for an 11px square. One
 * floating label now follows whichever day is hovered or focused.
 */
export function Heatmap({ stats, weeks = 53 }: { stats: Map<string, DayStat>; weeks?: number }) {
  const cells = useMemo(() => heatmapData(stats, weeks), [stats, weeks]);
  const summaryId = useId();
  const gridRef = useRef<HTMLDivElement>(null);

  // Pad the front so the first column starts on a Monday. heatmapData always
  // returns at least a week of days, so the old `?? Date.now()` fallback was
  // unreachable — and reading the clock during render made the render impure.
  const leading = cells.length > 0 ? (new Date(cells[0].ts).getDay() + 6) % 7 : 0;
  const padded: (HeatmapCell | null)[] = [...Array.from({ length: leading }, () => null), ...cells];
  const columnCount = Math.ceil(padded.length / 7);

  /** The day at a row and column, or null for the padding before the window and after today. */
  const cellAt = (row: number, col: number): HeatmapCell | null =>
    row >= 0 && row < 7 && col >= 0 && col < columnCount ? (padded[col * 7 + row] ?? null) : null;

  const lastIndex = padded.length - 1;
  const today: Position = { row: lastIndex % 7, col: Math.floor(lastIndex / 7) };
  const firstDay: Position = { row: leading, col: 0 };

  // Roving tab stop. Held as a position, so it can outlive a change of data —
  // a different period, or midnight passing — in which case it falls back to today.
  const [active, setActive] = useState<Position>(today);
  const current = cellAt(active.row, active.col) ? active : today;

  const [tip, setTip] = useState<Tip | null>(null);

  const monthLabels = Array.from({ length: columnCount }, (_, col) => {
    const firstInColumn = (c: number) => Array.from({ length: 7 }, (__, r) => cellAt(r, c)).find(Boolean);
    const first = firstInColumn(col);
    if (!first) return null;
    const d = new Date(first.ts);
    const previous = col > 0 ? firstInColumn(col - 1) : undefined;
    if (!previous) return d.getDate() <= 7 ? MONTHS[d.getMonth()] : null;
    return new Date(previous.ts).getMonth() !== d.getMonth() ? MONTHS[d.getMonth()] : null;
  });

  /** Positions the floating label over the day an element represents. */
  const showTipFor = (element: HTMLElement) => {
    if (element.dataset.row === undefined) return;
    const row = Number(element.dataset.row);
    const cell = cellAt(row, Number(element.dataset.col));
    if (!cell) return;
    const below = row <= 1;
    setTip({
      cell,
      left: element.offsetLeft + element.offsetWidth / 2,
      top: below ? element.offsetTop + element.offsetHeight + 6 : element.offsetTop - 6,
      below,
    });
  };

  /** Moves the tab stop and focus to a day, if there is one there. */
  const moveTo = ({ row, col }: Position) => {
    if (!cellAt(row, col)) return;
    setActive({ row, col });
    gridRef.current?.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const { row, col } = current;
    const inRow = (from: number, step: 1 | -1) => {
      for (let c = from; c >= 0 && c < columnCount; c += step) if (cellAt(row, c)) return c;
      return col;
    };

    const targets: Record<string, () => Position> = {
      ArrowLeft: () => ({ row, col: col - 1 }),
      ArrowRight: () => ({ row, col: col + 1 }),
      ArrowUp: () => ({ row: row - 1, col }),
      ArrowDown: () => ({ row: row + 1, col }),
      Home: () => (event.ctrlKey ? firstDay : { row, col: inRow(0, 1) }),
      End: () => (event.ctrlKey ? today : { row, col: inRow(columnCount - 1, -1) }),
    };

    const target = targets[event.key];
    if (!target) return;
    event.preventDefault();
    moveTo(target());
  };

  return (
    <div className="overflow-x-auto pb-1">
      <div className="relative inline-block min-w-full">
        <p id={summaryId} className="sr-only">
          {heatmapSummary(cells)}
        </p>

        <div aria-hidden="true" className="flex gap-[3px] pl-[26px] text-[10px] text-subtle">
          {monthLabels.map((label, i) => (
            <span key={i} className="w-[11px] shrink-0">
              {label ?? ''}
            </span>
          ))}
        </div>

        <div className="mt-1 flex gap-[3px]">
          {/* Visual only: each day's label names its weekday for assistive technology. */}
          <div
            aria-hidden="true"
            className="flex w-[23px] shrink-0 flex-col gap-[3px] text-[10px] leading-[11px] text-subtle"
          >
            {['', 'Tue', '', 'Thu', '', 'Sat', ''].map((label, i) => (
              <span key={i} className="h-[11px]">
                {label}
              </span>
            ))}
          </div>

          {/* tabIndex -1, not 0: in a roving-tabindex grid the single tab stop is
              a day, never the grid itself. It still has to be focusable to carry
              the delegated handlers, and focus landing on it is ignored below. */}
          <div
            ref={gridRef}
            tabIndex={-1}
            role="grid"
            aria-label="Focus history"
            aria-describedby={summaryId}
            aria-readonly="true"
            className="flex flex-col gap-[3px]"
            onKeyDown={onKeyDown}
            onFocus={(event) => {
              const element = event.target as HTMLElement;
              if (element.dataset.row === undefined) return;
              // Clicking a day focuses it too, so the tab stop follows the pointer.
              setActive({ row: Number(element.dataset.row), col: Number(element.dataset.col) });
              showTipFor(element);
            }}
            onBlur={() => setTip(null)}
            onPointerOver={(event) => showTipFor(event.target as HTMLElement)}
            onPointerLeave={() => setTip(null)}
          >
            {Array.from({ length: 7 }, (_, row) => (
              <div key={row} role="row" className="flex gap-[3px]">
                {Array.from({ length: columnCount }, (__, col) => {
                  const cell = cellAt(row, col);
                  if (!cell) {
                    return <span key={col} role="gridcell" aria-hidden="true" className="h-[11px] w-[11px]" />;
                  }
                  const isCurrent = row === current.row && col === current.col;
                  return (
                    <span
                      key={col}
                      role="gridcell"
                      tabIndex={isCurrent ? 0 : -1}
                      aria-label={heatmapCellLabel(cell)}
                      data-row={row}
                      data-col={col}
                      className={`h-[11px] w-[11px] rounded-[2px] transition-transform hover:scale-125 ${LEVEL_CLASS[cell.level]}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div aria-hidden="true" className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-subtle">
          Less
          {LEVEL_CLASS.map((cls, i) => (
            <span key={i} className={`h-[11px] w-[11px] rounded-[2px] ${cls}`} />
          ))}
          More
        </div>

        {tip && (
          // aria-hidden: the focused day's label already says this, so a
          // screen reader would otherwise hear it twice.
          <div
            data-heatmap-tooltip=""
            aria-hidden="true"
            className={`pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-elevated px-2 py-1 text-[11px] text-fg shadow-lift ${tip.below ? '' : '-translate-y-full'}`}
            style={{ left: tip.left, top: tip.top }}
          >
            {heatmapTooltipText(tip.cell)}
          </div>
        )}
      </div>
    </div>
  );
}
