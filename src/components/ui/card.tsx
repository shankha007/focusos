import * as React from 'react';
import { cn } from '@/lib/utils';

/** A padded surface panel — the container most content sits in. */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('panel p-5', className)} {...props} />;
}

/** The heading inside a card. */
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  // The children arrive through the spread, which the rule cannot follow — it
  // sees an empty heading. Every call site passes text.
  // eslint-disable-next-line jsx-a11y/heading-has-content
  return <h3 className={cn('text-sm font-semibold tracking-tight', className)} {...props} />;
}

/** Supporting text under a card's title. */
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[13px] leading-relaxed text-muted', className)} {...props} />;
}
