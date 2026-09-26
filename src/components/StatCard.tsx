import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  /** 0–1; renders a thin progress bar under the value. */
  progress?: number;
  tone?: 'default' | 'accent' | 'break' | 'warn';
  delay?: number;
}

/** A single headline number with its label, icon and optional progress bar. Fades in on mount; `delay` staggers a row of them. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  progress,
  tone = 'default',
  delay = 0,
}: StatCardProps) {
  const tones = {
    default: 'text-muted bg-elevated',
    accent: 'text-accent bg-accent/12',
    break: 'text-break bg-break/12',
    warn: 'text-warn bg-warn/12',
  };
  const bars = {
    default: 'bg-muted',
    accent: 'bg-accent',
    break: 'bg-break',
    warn: 'bg-warn',
  };

  return (
    <div
      className="enter-rise-tween panel panel-hover p-4"
      style={{ '--enter-delay': `${delay}s` } as React.CSSProperties}
    >
      <div className="flex items-start justify-between">
        <p className="text-[12px] font-medium text-muted">{label}</p>
        <span className={cn('grid h-7 w-7 place-items-center rounded-lg', tones[tone])}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>

      <p className="tabular mt-2.5 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-[12px] text-subtle">{hint}</p>}

      {progress !== undefined && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-subtle/20">
          <div
            className={cn('bar-fill h-full rounded-full', bars[tone])}
            style={
              {
                width: `${Math.min(100, progress * 100)}%`,
                '--bar-duration': '0.6s',
                '--bar-delay': `${delay + 0.1}s`,
              } as React.CSSProperties
            }
          />
        </div>
      )}
    </div>
  );
}
