import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  subtitle?: string;
  backTo?: string;
  onBack?: () => void;
  headerAction?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

/**
 * Standard form page shell used by all create/edit pages.
 * Provides back link, compact identity header, and a stacked white card layout
 * for form sections — matching the detail-page design system.
 */
const FormShell = ({
  title,
  subtitle,
  backTo,
  onBack,
  headerAction,
  footer,
  children,
  maxWidth = 'lg',
  className,
}: Props) => {
  const navigate = useNavigate();
  const handleBack = () => {
    if (onBack) onBack();
    else if (backTo) navigate(backTo);
    else navigate(-1);
  };

  const widthClass = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[maxWidth];

  return (
    <div className={cn('px-4 py-5 mx-auto pb-24', widthClass, className)}>
      <button
        onClick={handleBack}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="text-[17px] font-semibold text-foreground leading-tight tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13px] text-muted-foreground leading-snug mt-0.5">{subtitle}</p>
          )}
        </div>
        {headerAction}
      </div>

      <div className="space-y-4">{children}</div>

      {footer && (
        <div className="mt-6 flex flex-col sm:flex-row gap-2">{footer}</div>
      )}
    </div>
  );
};

export default FormShell;
