import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { toISODate } from '@/lib/vendorPayWeeks';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string | null;
  amount?: number;
  onSaved?: () => void;
}

const MarkPaidDialog = ({ open, onOpenChange, paymentId, amount, onSaved }: Props) => {
  const [paidAt, setPaidAt] = useState<string>(toISODate(new Date()));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setPaidAt(toISODate(new Date()));
  }, [open]);

  const handleSave = async () => {
    if (!paymentId || !paidAt) return;
    setSaving(true);
    const { error } = await supabase
      .from('vendor_payments')
      .update({ status: 'paid', paid_at: paidAt } as any)
      .eq('id', paymentId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Marked as paid');
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Mark Payment as Paid</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {amount !== undefined && (
            <p className="text-sm text-muted-foreground">Amount: <span className="text-foreground font-semibold">${Number(amount).toFixed(2)}</span></p>
          )}
          <div>
            <Label>Paid on</Label>
            <Input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Confirm Paid'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MarkPaidDialog;
