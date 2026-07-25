import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock, Unlock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getRecentSaturdays, thursdayAfter, toISODate, formatWeekLabel } from '@/lib/vendorPayWeeks';
import ProofLink from '@/components/vendors/ProofLink';

interface Payment {
  id: string;
  vendor_id: string;
  amount: number;
  week_ending_date: string | null;
  payment_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  status: 'pending' | 'paid' | string;
  note: string | null;
  proof_url: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment | null;
  onSaved?: () => void;
}

const EditVendorPaymentDialog = ({ open, onOpenChange, payment, onSaved }: Props) => {
  const saturdays = useMemo(() => getRecentSaturdays(8), [open]);
  const [weekEnding, setWeekEnding] = useState('');
  const [dueLocked, setDueLocked] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [replaceProof, setReplaceProof] = useState(false);
  const [saving, setSaving] = useState(false);

  const isPaid = payment?.status === 'paid';

  useEffect(() => {
    if (!open || !payment) return;
    const wk = payment.week_ending_date ?? payment.payment_date ?? '';
    setWeekEnding(wk);
    setDueDate(payment.due_date ?? (wk ? toISODate(thursdayAfter(wk)) : ''));
    setDueLocked(false);
    setAmount(String(payment.amount ?? ''));
    setNote(payment.note ?? '');
    setPaidAt(payment.paid_at ?? toISODate(new Date()));
    setProofFile(null);
    setReplaceProof(false);
  }, [open, payment]);

  useEffect(() => {
    if (dueLocked && weekEnding) setDueDate(toISODate(thursdayAfter(weekEnding)));
  }, [weekEnding, dueLocked]);

  // week list includes the current selection even if outside recent 8
  const weekOptions = useMemo(() => {
    const opts = saturdays.map(s => ({ iso: toISODate(s), label: formatWeekLabel(s) }));
    if (weekEnding && !opts.find(o => o.iso === weekEnding)) {
      opts.unshift({ iso: weekEnding, label: weekEnding });
    }
    return opts;
  }, [saturdays, weekEnding]);

  const handleSave = async () => {
    if (!payment) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (!weekEnding) { toast.error('Choose a week ending date'); return; }
    if (!dueDate) { toast.error('Due date required'); return; }
    if (isPaid && !paidAt) { toast.error('Paid date required'); return; }

    setSaving(true);
    try {
      let proof_url = payment.proof_url;
      if (isPaid && proofFile) {
        const ext = proofFile.name.split('.').pop() || 'jpg';
        const path = `${payment.vendor_id}/proofs/${payment.id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('vendor-documents')
          .upload(path, proofFile, { upsert: true, contentType: proofFile.type });
        if (upErr) { toast.error(upErr.message); return; }
        proof_url = path;
      }
      const update: any = {
        amount: amt,
        week_ending_date: weekEnding,
        payment_date: weekEnding,
        due_date: dueDate,
        note: note || null,
      };
      if (isPaid) {
        update.paid_at = paidAt;
        update.proof_url = proof_url;
      }
      const { error } = await supabase.from('vendor_payments').update(update).eq('id', payment.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Payment updated');
      onOpenChange(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Payment</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Week Ending (Saturday)</Label>
            <Select value={weekEnding} onValueChange={setWeekEnding}>
              <SelectTrigger><SelectValue placeholder="Choose week" /></SelectTrigger>
              <SelectContent>
                {weekOptions.map(o => (
                  <SelectItem key={o.iso} value={o.iso}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Due Date {dueLocked && <span className="text-xs text-muted-foreground">(auto — Thursday after week ending)</span>}</Label>
            <div className="flex items-center gap-2">
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={dueLocked} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setDueLocked(l => !l)}
                title={dueLocked ? 'Unlock to edit' : 'Lock to auto-calculate'}
              >
                {dueLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4 text-primary" />}
              </Button>
            </div>
          </div>

          <div>
            <Label>Amount ($)</Label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>

          <div>
            <Label>Note (optional)</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} />
          </div>

          {isPaid && (
            <>
              <div>
                <Label>Paid on</Label>
                <Input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} />
              </div>
              <div>
                <Label>Proof of payment <span className="text-muted-foreground font-normal">— optional</span></Label>
                {payment?.proof_url && !replaceProof ? (
                  <div className="flex items-center gap-3 mt-1">
                    <ProofLink path={payment.proof_url} />
                    <Button type="button" size="sm" variant="outline" onClick={() => setReplaceProof(true)}>
                      Replace
                    </Button>
                  </div>
                ) : (
                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={e => setProofFile(e.target.files?.[0] ?? null)}
                  />
                )}
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditVendorPaymentDialog;
