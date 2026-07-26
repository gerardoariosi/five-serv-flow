import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Check, Send, Lock, Plus, Pencil, Trash2 } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import { WHOLE_UNIT_KEY, WHOLE_UNIT_LABEL } from '@/lib/inspectionAreas';

const PricingReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Whole Unit item modal
  const [showWholeUnit, setShowWholeUnit] = useState(false);
  const [savingWholeUnit, setSavingWholeUnit] = useState(false);
  const [wholeUnitForm, setWholeUnitForm] = useState<{
    id: string | null;
    item_name: string;
    status: 'needs_repair' | 'urgent';
    quantity: number;
    unit_price: number;
    item_note: string;
  }>({ id: null, item_name: '', status: 'needs_repair', quantity: 1, unit_price: 0, item_note: '' });

  const fetchItems = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('inspection_items')
      .select('*')
      .eq('inspection_id', id)
      .in('status', ['needs_repair', 'urgent'])
      .order('status', { ascending: true });
    setItems(data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const wholeUnitItems = useMemo(() => items.filter(i => i.area === WHOLE_UNIT_KEY), [items]);
  const noContent = items.length === 0;

  const openWholeUnitNew = () => {
    setWholeUnitForm({ id: null, item_name: '', status: 'needs_repair', quantity: 1, unit_price: 0, item_note: '' });
    setShowWholeUnit(true);
  };

  const openWholeUnitEdit = (item: any) => {
    setWholeUnitForm({
      id: item.id,
      item_name: item.item_name ?? '',
      status: (item.status === 'urgent' ? 'urgent' : 'needs_repair'),
      quantity: item.quantity ?? 1,
      unit_price: item.unit_price ?? 0,
      item_note: item.item_note ?? '',
    });
    setShowWholeUnit(true);
  };

  const handleSaveWholeUnit = async () => {
    if (!wholeUnitForm.item_name.trim()) { toast.error('Item name is required'); return; }
    if (!id) return;
    setSavingWholeUnit(true);
    try {
      const qty = wholeUnitForm.quantity || 1;
      const price = wholeUnitForm.unit_price || 0;
      const payload = {
        inspection_id: id,
        area: WHOLE_UNIT_KEY,
        item_name: wholeUnitForm.item_name.trim(),
        status: wholeUnitForm.status,
        quantity: qty,
        unit_price: price,
        subtotal: qty * price,
        item_note: wholeUnitForm.item_note.trim() || null,
      };
      if (wholeUnitForm.id) {
        const { error } = await supabase.from('inspection_items').update(payload).eq('id', wholeUnitForm.id);
        if (error) throw error;
        toast.success('Item updated');
      } else {
        const { error } = await supabase.from('inspection_items').insert(payload);
        if (error) throw error;
        toast.success('Item added');
      }
      setShowWholeUnit(false);
      fetchItems();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save item');
    } finally {
      setSavingWholeUnit(false);
    }
  };

  const handleDeleteWholeUnitItem = async (itemId: string) => {
    const { error } = await supabase.from('inspection_items').delete().eq('id', itemId);
    if (error) { toast.error(error.message); return; }
    toast.success('Item deleted');
    fetchItems();
  };

  const updateItem = async (itemId: string, field: string, value: any) => {
    setItems(prev => prev.map(i => {
      if (i.id === itemId) {
        const updated = { ...i, [field]: value };
        if (field === 'quantity' || field === 'unit_price') {
          updated.subtotal = (updated.quantity ?? 1) * (updated.unit_price ?? 0);
        }
        return updated;
      }
      return i;
    }));
    const item = items.find(i => i.id === itemId);
    if (item) {
      const updatedVal: any = { [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? value : (item.quantity ?? 1);
        const price = field === 'unit_price' ? value : (item.unit_price ?? 0);
        updatedVal.subtotal = qty * price;
      }
      await supabase.from('inspection_items').update(updatedVal).eq('id', itemId);
    }
  };

  const total = useMemo(() =>
    items.reduce((sum, i) => sum + ((i.quantity ?? 1) * (i.unit_price ?? 0)), 0)
  , [items]);

  const allPriced = items.every(i => (i.quantity ?? 0) >= 1 && (i.unit_price ?? 0) > 0);

  const handleSendToPM = async () => {
    if (!allPriced) { toast.error('All items need quantity and price'); return; }
    setSending(true);

    try {
      // Fetch inspection details for email
      const { data: inspection } = await supabase
        .from('inspections')
        .select('ins_number, client_id, property_id, visit_date')
        .eq('id', id)
        .single();

      if (!inspection) { toast.error('Inspection not found'); setSending(false); return; }

      if (!inspection.client_id) {
        toast.error('No client assigned to this inspection. Please add a client before sending.');
        setSending(false);
        return;
      }

      // Fetch client email
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('email, company_name')
        .eq('id', inspection.client_id)
        .maybeSingle();

      if (clientError || !client?.email) {
        toast.error(clientError ? 'Failed to retrieve client info.' : 'Client has no email address. Please add one before sending.');
        setSending(false);
        return;
      }

      // Fetch property name
      const { data: property } = await supabase
        .from('properties')
        .select('name')
        .eq('id', inspection.property_id)
        .single();

      // Generate token and save
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      const portalUrl = `${window.location.origin}/portal/${token}`;

      await supabase.from('inspections').update({
        status: 'sent',
        pm_link_token: token,
        link_expires_at: expiresAt.toISOString(),
      }).eq('id', id);

      // Send email to PM
      const { error: emailError } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'pm-inspection-link',
          recipientEmail: client.email,
          idempotencyKey: `pm-inspection-${id}-${token}`,
          templateData: {
            ins_number: inspection.ins_number ?? '',
            property_name: property?.name ?? '',
            visit_date: inspection.visit_date ?? '',
            items_count: items.length,
            total_estimate: total.toFixed(2),
            portal_url: portalUrl,
            link_expires_at: expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          },
        },
      });

      if (emailError) {
        console.error('Email send error:', emailError);
        toast.warning('Inspection sent but email notification failed. Share the link manually.');
      } else {
        toast.success('Sent to PM! Email notification delivered.');
      }

      navigate(`/inspections/${id}`);
    } catch (err: any) {
      console.error('Send to PM error:', err);
      toast.error(`Failed to send to PM: ${err?.message || 'Unknown error'}`);
    }
    setSending(false);
  };

  const handleCloseInternally = async () => {
    await supabase.from('inspections').update({ status: 'closed_internally' }).eq('id', id);
    toast.success('Inspection closed internally');
    setShowCloseConfirm(false);
    navigate(`/inspections/${id}`);
  };

  // Group by area, excluding whole_unit (rendered separately)
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    const sorted = [...items].sort((a, b) => (a.status === 'urgent' ? -1 : 1) - (b.status === 'urgent' ? -1 : 1));
    sorted.forEach(i => {
      if (i.area === WHOLE_UNIT_KEY) return;
      const area = i.area ?? 'Other';
      if (!map[area]) map[area] = [];
      map[area].push(i);
    });
    return map;
  }, [items]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>;

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto pb-24 space-y-5">
      {/* Close internally confirm */}
      <Dialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Close Inspection Internally?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">All items are marked Good. No link will be sent to the PM. This action is logged.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseConfirm(false)}>Cancel</Button>
            <Button onClick={handleCloseInternally}>Close Internally</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Step 3 of 4</p>
            <h1 className="text-[17px] font-semibold text-foreground leading-tight tracking-tight">Pricing Review</h1>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {['Config', 'Inspect', 'Pricing', 'Sent'].map((step, i) => (
              <div key={step} className="flex items-center gap-1">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  i === 2 ? 'bg-primary text-primary-foreground' : i < 2 ? 'bg-success text-success-foreground' : 'bg-secondary text-muted-foreground'
                }`}>
                  {i < 2 ? <Check className="w-2.5 h-2.5" /> : i + 1}
                </div>
                {i < 3 && <div className="w-3 h-px bg-border" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Area sections (whole_unit excluded — rendered separately below) */}
      {Object.entries(grouped).map(([area, areaItems]) => (
        <section key={area} className="bg-card border border-border rounded-[0.625rem] shadow-[var(--card-shadow)] p-4 sm:p-5">
          <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-3">
            {area.replace(/_/g, ' ')}
          </h2>
          <div className="space-y-2">
            {areaItems.map((item: any) => (
              <div key={item.id} className="border border-border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{item.item_name}</span>
                  <Badge className={`text-[10px] ${item.status === 'urgent' ? 'bg-danger text-danger-foreground' : 'bg-warning text-warning-foreground'}`}>
                    {item.status === 'urgent' ? 'Urgent' : 'Needs Repair'}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Qty</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min={1}
                      value={item.quantity || ''}
                      onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                      onFocus={e => e.target.select()}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Unit Price ($)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.01}
                      value={item.unit_price || ''}
                      onChange={e => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                      onFocus={e => e.target.select()}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Subtotal</Label>
                    <div className="h-8 flex items-center text-sm font-semibold text-foreground tabular-nums mt-1">
                      ${((item.quantity ?? 1) * (item.unit_price ?? 0)).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Whole Unit section — always visible */}
      <section className="bg-card border border-border rounded-[0.625rem] shadow-[var(--card-shadow)] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">{WHOLE_UNIT_LABEL}</h2>
          <Button size="sm" variant="outline" onClick={openWholeUnitNew}>
            <Plus className="w-3 h-3 mr-1" /> Add Item
          </Button>
        </div>
        {wholeUnitItems.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No whole-unit items. Use this for items that apply to the entire property (e.g. full house painting, full carpet replacement, pest control).
          </p>
        ) : (
          <div className="space-y-2">
            {wholeUnitItems.map((item: any) => (
              <div key={item.id} className="border border-border rounded-md p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{item.item_name}</span>
                      <Badge className={`text-[10px] ${item.status === 'urgent' ? 'bg-danger text-danger-foreground' : 'bg-warning text-warning-foreground'}`}>
                        {item.status === 'urgent' ? 'Urgent' : 'Needs Repair'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                      Qty {item.quantity ?? 1} × ${(item.unit_price ?? 0).toFixed(2)} = <span className="font-semibold text-foreground">${((item.quantity ?? 1) * (item.unit_price ?? 0)).toFixed(2)}</span>
                    </p>
                    {item.item_note && (
                      <p className="text-xs text-muted-foreground mt-1 italic">→ {item.item_note}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openWholeUnitEdit(item)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteWholeUnitItem(item.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {noContent ? (
        <div className="bg-card border border-border rounded-[0.625rem] shadow-[var(--card-shadow)] p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto">
            <Check className="w-7 h-7" />
          </div>
          <div>
            <p className="text-foreground font-semibold">All items are in Good condition</p>
            <p className="text-sm text-muted-foreground mt-1">No repairs needed. Close this inspection internally or add a whole-unit item above.</p>
          </div>
          <Button onClick={() => setShowCloseConfirm(true)}>
            <Lock className="w-4 h-4 mr-1" /> Close Inspection Internally
          </Button>
        </div>
      ) : (
        <>
          {/* Total */}
          <div className="bg-card border border-border border-l-[3px] border-l-primary rounded-[0.625rem] shadow-[var(--card-shadow)] p-4 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Total</span>
            <span className="text-foreground text-2xl font-semibold tabular-nums">${total.toFixed(2)}</span>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handleSendToPM}
            disabled={!allPriced || sending}
          >
            {sending ? <Spinner size="sm" /> : <><Send className="w-5 h-5 mr-2" /> Send to PM</>}
          </Button>
        </>
      )}

      {/* Whole Unit dialog */}
      <Dialog open={showWholeUnit} onOpenChange={setShowWholeUnit}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{wholeUnitForm.id ? 'Edit Whole Unit Item' : 'Add Whole Unit Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Item Name</Label>
              <Input
                value={wholeUnitForm.item_name}
                onChange={e => setWholeUnitForm(f => ({ ...f, item_name: e.target.value }))}
                placeholder="e.g. Full House Painting"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={wholeUnitForm.status} onValueChange={v => setWholeUnitForm(f => ({ ...f, status: v as 'needs_repair' | 'urgent' }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="needs_repair">Needs Repair</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number" inputMode="numeric" min={1}
                  value={wholeUnitForm.quantity || ''}
                  onChange={e => setWholeUnitForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                  onFocus={e => e.target.select()}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Unit Price ($)</Label>
                <Input
                  type="number" inputMode="decimal" min={0} step={0.01}
                  value={wholeUnitForm.unit_price || ''}
                  onChange={e => setWholeUnitForm(f => ({ ...f, unit_price: parseFloat(e.target.value) || 0 }))}
                  onFocus={e => e.target.select()}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Textarea
                value={wholeUnitForm.item_note}
                onChange={e => setWholeUnitForm(f => ({ ...f, item_note: e.target.value }))}
                rows={3}
                placeholder="Any details about this item..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWholeUnit(false)} disabled={savingWholeUnit}>Cancel</Button>
            <Button onClick={handleSaveWholeUnit} disabled={savingWholeUnit || !wholeUnitForm.item_name.trim()}>
              {savingWholeUnit ? <Spinner size="sm" /> : (wholeUnitForm.id ? 'Save' : 'Add Item')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PricingReview;
