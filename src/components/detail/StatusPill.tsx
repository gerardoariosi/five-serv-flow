import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export type StatusPillVariant = 'success' | 'neutral' | 'warning' | 'danger' | 'info';

const variantClasses: Record<StatusPillVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  neutral: 'bg-muted text-muted-foreground border-border',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
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
