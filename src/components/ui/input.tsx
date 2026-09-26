import * as React from 'react';
import { cn } from '@/lib/utils';

/** A single-line text field in the app's style. */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg',
        'placeholder:text-subtle transition-colors',
        'focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/25',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

/** A multi-line text field in the app's style. */
export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[72px] w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-fg',
      'placeholder:text-subtle transition-colors resize-none',
      'focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/25',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
