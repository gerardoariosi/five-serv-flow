import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value?: ReactNode;
  editHref?: string;
  editLabel?: string;
  className?: string;
}

/**
 * Semantic label/value row. Empty read-only value renders "—".
 * If editHref is provided, an empty value renders a dashed-underline ghost link.
 */
const FieldRow = ({ label, value, editHref, editLabel, className }: Props) => {
  const isEmpty = value === null || value === undefined || value === '' || value === '—';
  return (
    <div className={cn('grid grid-cols-[110px_1fr] gap-3 py-1.5 items-start', className)}>
      <dt className="text-xs text-muted-foreground pt-0.5">{label}</dt>
      <dd className="text-sm text-foreground min-w-0 break-words">
        {isEmpty ? (
          editHref ? (
            <Link
              to={editHref}
              className="text-sm text-muted-foreground hover:text-foreground underline decoration-dashed underline-offset-2"
            >
              {editLabel ?? `Add ${label.toLowerCase()}`}
            </Link>
          ) : (
            <span className="text-muted-foreground/60">—</span>
          )
        ) : (
          value
        )}
      </dd>
    </div>
  );
};

export default FieldRow;
