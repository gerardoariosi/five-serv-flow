import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { ReactNode } from 'react';

interface BulkActionBarProps {
  count: number;
  itemNoun?: string;
  onDelete?: () => void;
  onClear: () => void;
  deleting?: boolean;
  extraActions?: ReactNode;
  hideDelete?: boolean;
}

const BulkActionBar = ({ count, itemNoun = 'item', onDelete, onClear, deleting, extraActions, hideDelete }: BulkActionBarProps) => {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card text-foreground border border-border rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 flex-wrap justify-center max-w-[95vw]">
      <span className="text-sm font-medium">{count} {itemNoun}{count === 1 ? '' : 's'} selected</span>
      {extraActions}
      {!hideDelete && onDelete && (
        <Button
          size="sm"
          disabled={deleting}
          onClick={onDelete}
          variant="destructive"
        >
          <Trash2 className="w-4 h-4 mr-1" /> Delete Selected
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
};

export default BulkActionBar;
