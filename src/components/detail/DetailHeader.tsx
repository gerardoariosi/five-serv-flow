import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  backTo?: string;
  onBack?: () => void;
  icon?: ReactNode;
  name: string;
  subline?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

const DetailHeader = ({ backTo, onBack, icon, name, subline, status, actions, className }: Props) => {
  const navigate = useNavigate();
  const handleBack = () => {
    if (onBack) onBack();
    else if (backTo) navigate(backTo);
    else navigate(-1);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <button
        onClick={handleBack}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      <div className="flex items-start gap-3">
        {icon && (
          <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0 text-primary">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[17px] font-semibold text-foreground leading-tight truncate">{name}</h1>
            {status}
          </div>
          {subline && (
            <p className="text-[13px] text-muted-foreground leading-snug mt-0.5 truncate">{subline}</p>
          )}
        </div>
      </div>

      {actions && <div className="flex items-center gap-1.5 flex-wrap">{actions}</div>}
    </div>
  );
};

export default DetailHeader;
