import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold motion-safe:transition-colors select-none focus:outline-none focus:ring-2 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-scarlet-600 text-cloud shadow-xs hover:bg-scarlet-700',
        scarlet:
          'border-transparent bg-scarlet-600 text-cloud shadow-xs hover:bg-scarlet-700',
        scarletSubtle:
          'border-scarlet-200 bg-scarlet-100/90 text-scarlet-800',
        sky:
          'border-transparent bg-sky-600 text-cloud shadow-xs hover:bg-sky-700',
        skySubtle:
          'border-sky-200 bg-sky-100 text-sky-900',
        secondary:
          'border-transparent bg-sky-100 text-sky-900 hover:bg-sky-200',
        outline:
          'border-sky-300 bg-cloud text-ink-primary',
        destructive:
          'border-transparent bg-scarlet-700 text-cloud hover:bg-scarlet-800',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
