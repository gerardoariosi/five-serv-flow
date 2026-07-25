import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export type StatusPillVariant = 'success' | 'neutral' | 'warning' | 'danger' | 'info' | 'purple' | 'gold';

const variantClasses: Record<StatusPillVariant, string> = {
  success: 'bg-success-soft text-success border-success/25',
  neutral: 'bg-muted text-muted-foreground border-border',
  warning: 'bg-warning-soft text-warning border-warning/25',
  danger:  'bg-danger-soft text-danger border-danger/25',
  info:    'bg-info-soft text-info border-info/25',
  purple:  'bg-purple-soft text-purple border-purple/25',
  gold:    'bg-primary/10 text-[hsl(45,100%,32%)] border-primary/30',
};

interface Props {
  variant?: StatusPillVariant;
  className?: string;
  children: ReactNode;
}

const StatusPill = ({ variant = 'neutral', className, children }: Props) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
      variantClasses[variant],
      className,
    )}
  >
    {children}
  </span>
);

export default StatusPill;
