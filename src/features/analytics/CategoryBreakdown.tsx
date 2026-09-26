import { useMemo } from 'react';
import { FolderOpen } from 'lucide-react';
import type { Category, Session } from '@/types';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Tooltip } from '@/components/ui/tooltip';
import { byCategory } from '@/engine/analytics';
import { formatDuration, pluralize } from '@/lib/utils';

/**
 * Where the period's focus actually went, by category.
 *
 * Categories have always been assignable to tasks and wired to timer presets,
 * but nothing ever reported on them: sessions were written without a category,
 * so there was nothing to group by. Now that they carry one, this is the
 * question the data model was built to answer.
 */
export function CategoryBreakdown({
  sessions,
  categories,
}: {
  sessions: Session[];
  categories: Category[];
}) {
  const rows = useMemo(() => byCategory(sessions, categories), [sessions, categories]);

  const headline = useMemo(() => {
    const named = rows.filter((r) => r.categoryId);
    if (named.length === 0) return null;
    const top = named[0];
    return `${top.name} took ${Math.round(top.share * 100)}% of your focus — ${formatDuration(top.focusMs)}.`;
  }, [rows]);

  return (
    <Card>
      <CardTitle>Where your focus went</CardTitle>
      <CardDescription>
        {headline ?? 'Give your tasks a category and this splits your focus time across them.'}
      </CardDescription>

      {rows.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No focus logged yet"
          description="Sessions appear here once you have run a few."
          className="py-8"
        />
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.categoryId ?? 'uncategorised'}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="truncate text-[13px] font-medium">{row.name}</span>
                  {row.avgProductivity !== null && (
                    <Tooltip content={`Average productivity rating across ${row.name}`}>
                      <span className="tabular shrink-0 text-[11px] text-subtle">
                        {row.avgProductivity.toFixed(1)}/5
                      </span>
                    </Tooltip>
                  )}
                </span>
                <span className="tabular shrink-0 text-[12px] text-subtle">
                  {formatDuration(row.focusMs)} · {Math.round(row.share * 100)}%
                </span>
              </div>

              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle/15">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(2, row.share * 100)}%`,
                    backgroundColor: row.color,
                  }}
                />
              </div>

              <p className="mt-1 text-[11px] text-subtle">
                {row.sessions} completed {pluralize(row.sessions, 'session')}
                {!row.categoryId && ' · sessions with no category on their task'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
