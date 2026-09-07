import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as SliderPrimitive from '@radix-ui/react-slider';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Card ──────────────────────────────────────────────────── */

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

/* ── Input / Textarea ──────────────────────────────────────── */

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

/* ── Badge ─────────────────────────────────────────────────── */

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

/* ── Dialog ────────────────────────────────────────────────── */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/** The modal panel itself: overlay, centring, scrolling, and a close button unless `hideClose` is set. */
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }
>(({ className, children, hideClose, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm data-[state=open]:animate-fade-in" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2',
        'max-h-[calc(100vh-2rem)] overflow-y-auto',
        'rounded-2xl border border-border bg-surface p-6 shadow-lift',
        'data-[state=open]:animate-dialog-in',
        className,
      )}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close
          className="absolute right-4 top-4 rounded-lg p-1.5 text-subtle transition-colors hover:bg-elevated hover:text-fg"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';

/** A dialog's heading. Radix requires one for accessibility. */
export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-base font-semibold tracking-tight', className)}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

/** Supporting text under a dialog's title, announced with it by screen readers. */
export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('mt-1 text-[13px] leading-relaxed text-muted', className)}
    {...props}
  />
));
DialogDescription.displayName = 'DialogDescription';

/* ── Switch ────────────────────────────────────────────────── */

/** An on/off toggle, used throughout settings. */
export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-full',
      'border-2 border-transparent transition-colors duration-200',
      'data-[state=checked]:bg-accent data-[state=unchecked]:bg-subtle/35',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-[18px] w-[18px] rounded-full bg-white shadow-sm',
        'transition-transform duration-200 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';

/* ── Slider ────────────────────────────────────────────────── */

/** A draggable range control. Pass `aria-label` — it is forwarded to the thumb, which is the element assistive tech actually sees. */
export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, 'aria-label': ariaLabel, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex w-full touch-none select-none items-center', className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-subtle/25">
      <SliderPrimitive.Range className="absolute h-full bg-accent" />
    </SliderPrimitive.Track>
    {/* Radix puts role="slider" on the thumb, so the label has to travel with
        it. Left on the root it names a plain wrapper div and assistive tech
        announces an unlabelled slider. */}
    <SliderPrimitive.Thumb
      aria-label={ariaLabel}
      className="block h-4 w-4 rounded-full border-2 border-accent bg-surface shadow-soft transition-transform hover:scale-110 focus-visible:outline-none"
    />
  </SliderPrimitive.Root>
));
Slider.displayName = 'Slider';

/* ── Tooltip ───────────────────────────────────────────────── */

export const TooltipProvider = TooltipPrimitive.Provider;

/** Wraps a child so hovering or focusing it reveals `content`. Renders the child bare when there is nothing to say. */
export function Tooltip({
  children,
  content,
  side = 'top',
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  if (!content) return <>{children}</>;
  return (
    <TooltipPrimitive.Root delayDuration={400}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-[12px] font-medium text-fg shadow-lift data-[state=delayed-open]:animate-fade-in"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/* ── Tabs ──────────────────────────────────────────────────── */

export const Tabs = TabsPrimitive.Root;

/** The row of tab buttons. */
export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex items-center gap-1 rounded-xl border border-border bg-elevated p-1',
      className,
    )}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

/** One tab button, highlighted while its panel is showing. */
export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted transition-all',
      'hover:text-fg data-[state=active]:bg-surface data-[state=active]:text-fg data-[state=active]:shadow-soft',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = TabsPrimitive.Content;

/* ── Select ────────────────────────────────────────────────── */

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

/** The closed dropdown: shows the current choice and opens the list. */
export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-border bg-bg px-3 text-sm',
      'transition-colors hover:border-subtle/40 focus:outline-none focus:ring-2 focus:ring-accent/25',
      'data-[placeholder]:text-subtle',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0 text-subtle" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

/** The dropdown's popup list, positioned against its trigger. */
export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position="popper"
      sideOffset={4}
      className={cn(
        'z-50 max-h-72 min-w-[8rem] overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-lift',
        'data-[state=open]:animate-fade-in',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-0">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = 'SelectContent';

/** One option in a dropdown, tick-marked while selected. */
export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2 rounded-lg py-1.5 pl-2 pr-8 text-sm',
      'outline-none transition-colors focus:bg-elevated data-[state=checked]:text-accent',
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="absolute right-2">
      <Check className="h-3.5 w-3.5" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';

/* ── Empty state ───────────────────────────────────────────── */

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
