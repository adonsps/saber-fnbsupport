import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold motion-safe:transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-scarlet-600 text-cloud shadow-sm hover:bg-scarlet-700 focus-visible:ring-scarlet-600',
        scarlet:
          'bg-scarlet-600 text-cloud shadow-sm hover:bg-scarlet-700 focus-visible:ring-scarlet-600',
        sky:
          'bg-sky-600 text-cloud shadow-sm hover:bg-sky-700 focus-visible:ring-sky-600',
        secondary:
          'bg-sky-100 text-sky-900 hover:bg-sky-200 focus-visible:ring-sky-600',
        outline:
          'border border-sky-300 bg-cloud text-ink-primary shadow-xs hover:bg-sky-50 focus-visible:ring-sky-600',
        ghost:
          'text-ink-primary hover:bg-sky-100/70 hover:text-ink-primary focus-visible:ring-sky-600',
        destructive:
          'bg-scarlet-700 text-cloud shadow-sm hover:bg-scarlet-800 focus-visible:ring-scarlet-700',
        link:
          'text-sky-600 underline-offset-4 hover:underline focus-visible:ring-sky-600',
      },
      size: {
        default: 'h-10 px-4 py-2 text-sm',
        sm: 'h-9 rounded-md px-3 text-xs',
        lg: 'min-h-[44px] h-12 rounded-full px-6 text-base',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
