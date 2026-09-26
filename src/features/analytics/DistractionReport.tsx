import { useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { Distraction, DistractionCategory } from '@/types';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { distractionPatterns } from '@/engine/analytics';
import { fmtHour } from '@/engine/adaptive';
import { pluralize } from '@/lib/utils';

/** Ranks what interrupts the user most, with each cause's share and the point in a session it usually strikes. */
export function DistractionReport({
  distractions,
  categories,
}: {
  distractions: Distraction[];
  categories: DistractionCategory[];
}) {
  const patterns = useMemo(
    () => distractionPatterns(distractions, categories),
    [distractions, categories],
  );

  const headline = useMemo(() => {
    if (patterns.length === 0) return null;
    const top = patterns[0];
    const parts = [`${top.label} is your most common interruption`];
    if (top.peakHour !== null) parts.push(`peaking around ${fmtHour(top.peakHour)}`);
    if (top.avgProgress !== null)
      parts.push(`typically ${Math.round(top.avgProgress * 100)}% into a session`);
    return `${parts.join(', ')}.`;
  }, [patterns]);

  return (
    <Card>
      <CardTitle>Distraction patterns</CardTitle>
      <CardDescription>
        {headline ?? 'Nothing logged for this period — either a great run or a quiet one.'}
      </CardDescription>

      {patterns.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No distractions logged"
          description="Log them mid-session with D in deep focus, and patterns will surface here."
          className="py-8"
        />
      ) : (
        <ul className="mt-4 space-y-3">
          {patterns.map((p) => (
            <li key={p.categoryId}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="truncate text-[13px] font-medium">{p.label}</span>
                </span>
                <span className="tabular shrink-0 text-[12px] text-subtle">
                  {p.count} {pluralize(p.count, 'time')} · {Math.round(p.share * 100)}%
                </span>
              </div>

              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle/15">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${p.share * 100}%`, backgroundColor: p.color }}
                />
              </div>

              {p.avgProgress !== null && (
                <p className="mt-1 text-[11px] text-subtle">
                  Usually hits {Math.round(p.avgProgress * 100)}% into a session
                  {p.peakHour !== null && ` · most often around ${fmtHour(p.peakHour)}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
