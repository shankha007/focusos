import * as React from 'react';
import { cn } from '@/lib/utils';

/** A small pill label, coloured by `tone` to signal status. */
export function Badge({
  className,
  tone = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'default' | 'accent' | 'success' | 'warn' | 'danger' | 'muted';
}) {
  const tones = {
    default: 'bg-elevated text-muted border-border',
    accent: 'bg-accent/12 text-accent border-accent/20',
    success: 'bg-success/12 text-success border-success/20',
    warn: 'bg-warn/12 text-warn border-warn/20',
    danger: 'bg-danger/12 text-danger border-danger/20',
    muted: 'bg-elevated text-subtle border-border',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
