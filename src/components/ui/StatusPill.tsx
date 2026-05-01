import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface StatusPillProps {
  className?: string;
  children: ReactNode;
}

/**
 * Standardized pill-style badge used for statuses, work types, and priorities.
 * Always: rounded-full, px-2.5 py-0.5, text-[11px], font-semibold.
 */
const StatusPill = ({ className, children }: StatusPillProps) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-current/20 whitespace-nowrap',
      className,
    )}
  >
    {children}
  </span>
);

export default StatusPill;
