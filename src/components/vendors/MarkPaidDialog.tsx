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
  vendorId?: string;
  amount?: number;
  onSaved?: () => void;
}

const MarkPaidDialog = ({ open, onOpenChange, paymentId, vendorId, amount, onSaved }: Props) => {
  const [paidAt, setPaidAt] = useState<string>(toISODate(new Date()));
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPaidAt(toISODate(new Date()));
      setProofFile(null);
    }
  }, [open]);

  const handleSave = async () => {
    if (!paymentId || !paidAt) return;
    setSaving(true);
    try {
      let proof_url: string | null = null;
      if (proofFile && vendorId) {
        const ext = proofFile.name.split('.').pop() || 'jpg';
        const path = `${vendorId}/proofs/${paymentId}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('vendor-documents')
          .upload(path, proofFile, { upsert: true, contentType: proofFile.type });
        if (upErr) { toast.error(upErr.message); setSaving(false); return; }
        proof_url = path;
      }
      const update: any = { status: 'paid', paid_at: paidAt };
      if (proof_url) update.proof_url = proof_url;
      const { error } = await supabase
        .from('vendor_payments')
        .update(update)
        .eq('id', paymentId);
      if (error) { toast.error(error.message); return; }
      toast.success('Marked as paid');
      onOpenChange(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
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
          <div>
            <Label>Attach proof of payment <span className="text-muted-foreground font-normal">— optional</span></Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={e => setProofFile(e.target.files?.[0] ?? null)}
            />
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
