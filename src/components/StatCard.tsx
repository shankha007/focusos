import { motion } from 'framer-motion';
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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.22, 1, 0.36, 1] }}
      className="panel panel-hover p-4"
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
          <motion.div
            className={cn('h-full rounded-full', bars[tone])}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, progress * 100)}%` }}
            transition={{ duration: 0.6, delay: delay + 0.1, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      )}
    </motion.div>
  );
}
