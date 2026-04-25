import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Check, Send, DollarSign, Lock } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';

const PricingReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

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

  const allGood = items.length === 0;

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

  // Group by area
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    const sorted = [...items].sort((a, b) => (a.status === 'urgent' ? -1 : 1) - (b.status === 'urgent' ? -1 : 1));
    sorted.forEach(i => {
      const area = i.area ?? 'Other';
      if (!map[area]) map[area] = [];
      map[area].push(i);
    });
    return map;
  }, [items]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5">
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

      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Pricing Review</h1>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-center gap-2">
        {['Config', 'Inspect', 'Pricing', 'Sent'].map((step, i) => (
          <div key={step} className="flex items-center gap-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
              i === 2 ? 'bg-primary text-primary-foreground' : i < 2 ? 'bg-green-500 text-white' : 'bg-secondary text-muted-foreground'
            }`}>
              {i < 2 ? <Check className="w-3 h-3" /> : i + 1}
            </div>
            {i < 3 && <div className="w-4 h-px bg-border" />}
          </div>
        ))}
      </div>

      {allGood ? (
        <div className="text-center py-12 space-y-4">
          <Check className="w-16 h-16 text-green-500 mx-auto" />
          <p className="text-foreground font-medium">All items are in Good condition!</p>
          <p className="text-sm text-muted-foreground">No repairs needed. You can close this inspection internally.</p>
          <Button onClick={() => setShowCloseConfirm(true)}>
            <Lock className="w-4 h-4 mr-1" /> Close Inspection Internally
          </Button>
        </div>
      ) : (
        <>
          {/* Items grouped by area */}
          {Object.entries(grouped).map(([area, areaItems]) => (
            <div key={area} className="space-y-2">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{area.replace(/_/g, ' ')}</h3>
              {areaItems.map((item: any) => (
                <div key={item.id} className="bg-card border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{item.item_name}</span>
                    <Badge className={`text-[10px] ${item.status === 'urgent' ? 'bg-destructive text-destructive-foreground' : 'bg-orange-500 text-white'}`}>
                      {item.status === 'urgent' ? 'Urgent' : 'Needs Repair'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px]">Qty</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min={1}
                        value={item.quantity || ''}
                        onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                        onFocus={e => e.target.select()}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Unit Price ($)</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.01}
                        value={item.unit_price || ''}
                        onChange={e => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                        onFocus={e => e.target.select()}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Subtotal</Label>
                      <div className="h-8 flex items-center text-sm font-medium text-primary">
                        ${((item.quantity ?? 1) * (item.unit_price ?? 0)).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Total */}
          <div className="bg-white border-l-4 border-[#FFD700] rounded-lg p-4 flex items-center justify-between">
            <span className="text-gray-500 text-sm font-medium">Total</span>
            <span className="text-[#1A1A1A] text-2xl font-bold">${total.toFixed(2)}</span>
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
    </div>
  );
};

export default PricingReview;
