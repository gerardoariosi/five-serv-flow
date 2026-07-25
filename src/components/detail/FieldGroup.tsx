import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  label?: string;
  action?: ReactNode;
  first?: boolean;
  children: ReactNode;
  className?: string;
}

const FieldGroup = ({ label, action, first, children, className }: Props) => (
  <section
    className={cn(
      'pt-4',
      !first && 'border-t border-border/60 mt-4',
      className,
    )}
  >
    {(label || action) && (
      <div className="flex items-center justify-between mb-1">
        {label && (
          <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            {label}
          </h2>
        )}
        {action}
      </div>
    )}
    <dl className="divide-y divide-transparent">{children}</dl>
  </section>
);

export default FieldGroup;
