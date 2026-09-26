import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

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
