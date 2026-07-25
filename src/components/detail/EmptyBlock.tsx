import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

const EmptyBlock = ({ icon: Icon, title, description, action, className }: Props) => (
  <div
    role="status"
    className={cn(
      'flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-border/70 bg-transparent px-4 py-8 min-h-[140px]',
      className,
    )}
  >
    <Icon className="w-5 h-5 text-muted-foreground/50 mb-2" />
    <p className="text-sm font-medium text-foreground">{title}</p>
    {description && <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">{description}</p>}
    {action && <div className="mt-3">{action}</div>}
  </div>
);

export default EmptyBlock;
