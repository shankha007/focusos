import * as React from 'react';
import { cn } from '@/lib/utils';

/** What a list shows when it has nothing in it: an icon, an explanation, and usually the button that fixes it. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-border bg-elevated">
        <Icon className="h-5 w-5 text-subtle" />
      </div>
      <p className="text-sm font-medium text-fg">{title}</p>
      <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
