import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Consistent label + control wrapper. Label uses the same small-caps treatment
 * as detail-page metadata labels for visual continuity.
 */
const FormField = ({ label, hint, error, required, htmlFor, children, className }: Props) => (
  <div className={cn('space-y-1.5', className)}>
    {label && (
      <label
        htmlFor={htmlFor}
        className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
    )}
    {children}
    {error ? (
      <p className="text-xs text-destructive">{error}</p>
    ) : hint ? (
      <p className="text-xs text-muted-foreground">{hint}</p>
    ) : null}
  </div>
);

export default FormField;
