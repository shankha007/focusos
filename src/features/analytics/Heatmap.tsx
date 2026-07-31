import { useMemo } from 'react';
import type { DayStat } from '@/types';
import { Tooltip } from '@/components/ui/primitives';
import { heatmapData } from '@/engine/analytics';
import { formatDuration, pluralize } from '@/lib/utils';

const LEVEL_CLASS = [
  'bg-subtle/12',
  'bg-accent/25',
  'bg-accent/45',
  'bg-accent/70',
  'bg-accent',
] as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** GitHub-style contribution grid: one column per week, one cell per day. */
export function Heatmap({ stats, weeks = 53 }: { stats: Map<string, DayStat>; weeks?: number }) {
  const cells = useMemo(() => heatmapData(stats, weeks), [stats, weeks]);

  // Pad the front so the first column starts on a Monday.
  const leading = (new Date(cells[0]?.ts ?? Date.now()).getDay() + 6) % 7;
  const padded = [...Array.from({ length: leading }, () => null), ...cells];

  const columns: (typeof cells[number] | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) columns.push(padded.slice(i, i + 7));

  const monthLabels = columns.map((col, i) => {
    const firstReal = col.find((c) => c !== null);
    if (!firstReal) return null;
    const d = new Date(firstReal.ts);
    const prev = columns[i - 1]?.find((c) => c !== null);
    if (!prev) return d.getDate() <= 7 ? MONTHS[d.getMonth()] : null;
    return new Date(prev.ts).getMonth() !== d.getMonth() ? MONTHS[d.getMonth()] : null;
  });

  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-block min-w-full">
        <div className="flex gap-[3px] pl-[26px] text-[10px] text-subtle">
          {columns.map((_, i) => (
            <span key={i} className="w-[11px] shrink-0">
              {monthLabels[i] ?? ''}
            </span>
          ))}
        </div>

        <div className="mt-1 flex gap-[3px]">
          <div className="flex w-[23px] shrink-0 flex-col gap-[3px] text-[10px] leading-[11px] text-subtle">
            {['', 'Tue', '', 'Thu', '', 'Sat', ''].map((label, i) => (
              <span key={i} className="h-[11px]">
                {label}
              </span>
            ))}
          </div>

          {columns.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }, (_, ri) => {
                const cell = col[ri];
                if (!cell) return <span key={ri} className="h-[11px] w-[11px]" />;
                return (
                  <Tooltip
                    key={ri}
                    content={
                      cell.focusMs > 0
                        ? `${formatDuration(cell.focusMs)} · ${cell.sessions} ${pluralize(cell.sessions, 'session')} on ${cell.date}`
                        : `No focus on ${cell.date}`
                    }
                  >
                    <span
                      className={`h-[11px] w-[11px] rounded-[2px] transition-transform hover:scale-125 ${LEVEL_CLASS[cell.level]}`}
                    />
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-subtle">
          Less
          {LEVEL_CLASS.map((cls, i) => (
            <span key={i} className={`h-[11px] w-[11px] rounded-[2px] ${cls}`} />
          ))}
          More
        </div>
      </div>
    </div>
  );
}
