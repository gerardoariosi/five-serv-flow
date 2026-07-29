import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock, Unlock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import { getRecentSaturdays, thursdayAfter, toISODate, formatWeekLabel } from '@/lib/vendorPayWeeks';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId?: string;      // when provided, vendor picker is locked
  vendorName?: string;
  onSaved?: () => void;
}

const AddVendorPaymentDialog = ({ open, onOpenChange, vendorId, vendorName, onSaved }: Props) => {
  const { user } = useAuthStore();
  const saturdays = useMemo(() => getRecentSaturdays(6), [open]);
  const defaultWeek = saturdays[0] ? toISODate(saturdays[0]) : '';

  const [selectedVendor, setSelectedVendor] = useState<string>(vendorId ?? '');
  const [weekEnding, setWeekEnding] = useState<string>(defaultWeek);
  const [dueLocked, setDueLocked] = useState(true);
  const [dueDate, setDueDate] = useState<string>(defaultWeek ? toISODate(thursdayAfter(defaultWeek)) : '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [vendorOptions, setVendorOptions] = useState<Array<{ id: string; company_name: string }>>([]);
  const [vendorSearch, setVendorSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setSelectedVendor(vendorId ?? '');
    setWeekEnding(defaultWeek);
    setDueLocked(true);
    setDueDate(defaultWeek ? toISODate(thursdayAfter(defaultWeek)) : '');
    setAmount('');
    setNote('');
    setVendorSearch('');
  }, [open, vendorId, defaultWeek]);

  useEffect(() => {
    if (dueLocked && weekEnding) {
      setDueDate(toISODate(thursdayAfter(weekEnding)));
    }
  }, [weekEnding, dueLocked]);

  useEffect(() => {
    if (!open || vendorId) return;
    (async () => {
      const { data } = await supabase
        .from('technicians_vendors')
        .select('id, company_name')
        .eq('type', 'vendor')
        .eq('status', 'active')
        .eq('is_deleted', false)
        .order('company_name');
      setVendorOptions(data ?? []);
    })();
  }, [open, vendorId]);

  const filteredVendors = useMemo(() => {
    if (!vendorSearch) return vendorOptions;
    const q = vendorSearch.toLowerCase();
    return vendorOptions.filter(v => v.company_name?.toLowerCase().includes(q));
  }, [vendorOptions, vendorSearch]);

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!selectedVendor) { toast.error('Choose a vendor'); return; }
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (!weekEnding) { toast.error('Choose a week ending date'); return; }
    if (!dueDate) { toast.error('Due date required'); return; }
    if (!user?.id) return;

    setSaving(true);
    const { error } = await supabase.from('vendor_payments').insert({
      vendor_id: selectedVendor,
      amount: amt,
      payment_date: weekEnding, // legacy column mirrors week_ending
      week_ending_date: weekEnding,
      due_date: dueDate,
      status: 'pending',
      note: note || null,
      created_by: user.id,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Payment scheduled');
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Vendor Payment</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Vendor</Label>
            {vendorId ? (
              <div className="flex items-center gap-2 mt-1 px-3 py-2 rounded-md border border-border bg-muted/40 text-sm">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-foreground font-medium">{vendorName ?? 'Selected vendor'}</span>
              </div>
            ) : (
              <>
                <Input placeholder="Search vendor..." value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} className="mb-2" />
                <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                  <SelectTrigger><SelectValue placeholder="Choose vendor" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {filteredVendors.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
                    ))}
                    {filteredVendors.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No vendors</div>}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          <div>
            <Label>Week Ending (Saturday)</Label>
            <Select value={weekEnding} onValueChange={setWeekEnding}>
              <SelectTrigger><SelectValue placeholder="Choose week" /></SelectTrigger>
              <SelectContent>
                {saturdays.map(sat => {
                  const iso = toISODate(sat);
                  return <SelectItem key={iso} value={iso}>{formatWeekLabel(sat)}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Due Date {dueLocked && <span className="text-xs text-muted-foreground">(auto — Thursday after week ending)</span>}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                disabled={dueLocked}
              />
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
            <Input placeholder="e.g. 3 days, Mon–Wed" value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Add Payment'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddVendorPaymentDialog;
