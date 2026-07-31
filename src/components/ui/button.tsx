import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] select-none',
  {
    variants: {
      variant: {
        default:
          'bg-accent text-accent-fg shadow-soft hover:brightness-110 hover:shadow-lift',
        secondary:
          'bg-elevated text-fg border border-border hover:bg-elevated hover:border-subtle/40 shadow-soft',
        ghost: 'text-muted hover:bg-elevated hover:text-fg',
        outline: 'border border-border text-fg hover:bg-elevated',
        danger: 'bg-danger text-white hover:brightness-110',
        subtle: 'bg-accent/10 text-accent hover:bg-accent/16',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        default: 'h-9 px-4',
        lg: 'h-11 px-6 text-[15px]',
        icon: 'h-9 w-9',
        'icon-sm': 'h-8 w-8',
        'icon-lg': 'h-12 w-12',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
