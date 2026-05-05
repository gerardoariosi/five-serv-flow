import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface BulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemNames: string[];
  totalCount: number;
  onConfirm: () => void;
  loading?: boolean;
  customMessage?: string;
  customTitle?: string;
}

const BulkDeleteDialog = ({
  open, onOpenChange, itemNames, totalCount, onConfirm, loading, customMessage, customTitle,
}: BulkDeleteDialogProps) => {
  const preview = itemNames.slice(0, 3);
  const more = totalCount - preview.length;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customTitle ?? `Delete ${totalCount} item${totalCount === 1 ? '' : 's'}?`}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {customMessage ?? 'This action cannot be undone.'}
        </p>
        {preview.length > 0 && (
          <ul className="text-sm text-foreground space-y-1 max-h-40 overflow-y-auto">
            {preview.map((n, i) => <li key={i} className="truncate">• {n || 'Unnamed'}</li>)}
            {more > 0 && <li className="text-muted-foreground">…and {more} more</li>}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button
            disabled={loading}
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white border-0"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkDeleteDialog;
