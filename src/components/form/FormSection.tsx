import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Grouped form section rendered as a white card. Optional title/description
 * appear above the fields with the same treatment as detail-page groups.
 */
const FormSection = ({ title, description, action, children, className }: Props) => (
  <section
    className={cn(
      'bg-card border border-border rounded-[0.625rem] shadow-[var(--card-shadow)] p-4 sm:p-5',
      className,
    )}
  >
    {(title || action) && (
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="min-w-0">
          {title && (
            <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {action}
      </div>
    )}
    <div className="space-y-4">{children}</div>
  </section>
);

export default FormSection;
