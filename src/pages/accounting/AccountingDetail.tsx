import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Save, FileDown, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';

const AccountingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeRole } = useAuthStore();
  const canEdit = activeRole === 'admin' || activeRole === 'accounting';

  const [billingStatus, setBillingStatus] = useState('pending');
  const [qbInvoice, setQbInvoice] = useState('');
  const [accountingNotes, setAccountingNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);

  const { data: ticket } = useQuery({
    queryKey: ['accounting-ticket', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, clients(company_name, contact_name, email), properties(name, address), zones(name)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: photos = [] } = useQuery({
    queryKey: ['ticket-photos', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_photos')
        .select('*')
        .eq('ticket_id', id!)
        .order('uploaded_at');
      if (error) throw error;
      return data;
    },
  });

  const { data: approver } = useQuery({
    queryKey: ['approver', ticket?.approved_by],
    queryFn: async () => {
      if (!ticket?.approved_by) return null;
      const { data } = await supabase.from('users').select('full_name').eq('id', ticket.approved_by).single();
      return data;
    },
    enabled: !!ticket?.approved_by,
  });

  const { data: technician } = useQuery({
    queryKey: ['technician-name', ticket?.technician_id],
    queryFn: async () => {
      if (!ticket?.technician_id) return null;
      const { data } = await supabase.from('users').select('full_name').eq('id', ticket.technician_id).single();
      return data;
    },
    enabled: !!ticket?.technician_id,
  });

  useEffect(() => {
    if (ticket) {
      setBillingStatus(ticket.billing_status || 'pending');
      setQbInvoice(ticket.qb_invoice_number || '');
      setAccountingNotes(ticket.accounting_notes || '');
    }
  }, [ticket]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('tickets').update({
      billing_status: billingStatus,
      qb_invoice_number: qbInvoice || null,
      accounting_notes: accountingNotes || null,
    }).eq('id', id!);
    setSaving(false);
    if (error) { toast.error('Save failed'); return; }
    toast.success('Billing info updated');
  };

  const fmtDate = (d: string | null) => d ? format(new Date(d), 'MMM d, yyyy h:mm a') : '—';

  const photosByStage = (stage: string) => photos.filter((p) => p.stage === stage);

  if (!ticket) return <div className="p-4 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/accounting')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">{ticket.fs_number || 'Ticket'}</h1>
          <div className="flex gap-2 mt-1">
            <Badge variant="outline" className="text-[10px]">{ticket.work_type}</Badge>
            <Badge variant="outline" className="text-[10px]">{ticket.status}</Badge>
          </div>
        </div>
      </div>

      {/* Read-Only Info */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Ticket Information</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">PM:</span> <span className="text-foreground">{(ticket.clients as any)?.company_name || '—'}</span></div>
          <div><span className="text-muted-foreground">Property:</span> <span className="text-foreground">{(ticket.properties as any)?.name || (ticket.properties as any)?.address || '—'}</span></div>
          <div><span className="text-muted-foreground">Unit:</span> <span className="text-foreground">{ticket.unit || '—'}</span></div>
          <div><span className="text-muted-foreground">Type:</span> <span className="text-foreground">{ticket.work_type || '—'}</span></div>
          <div><span className="text-muted-foreground">Technician:</span> <span className="text-foreground">{technician?.full_name || '—'}</span></div>
          <div><span className="text-muted-foreground">Approved by:</span> <span className="text-foreground">{approver?.full_name || '—'}</span></div>
        </div>
        {ticket.description && (
          <div>
            <span className="text-xs text-muted-foreground">Description:</span>
            <p className="text-sm text-foreground mt-1">{ticket.description}</p>
          </div>
        )}
      </div>

      {/* Timestamps */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Timestamps</h2>
        <div className="grid grid-cols-1 gap-1 text-sm">
          <div><span className="text-muted-foreground">Appointment:</span> <span className="text-foreground">{fmtDate(ticket.appointment_time)}</span></div>
          <div><span className="text-muted-foreground">Work Started:</span> <span className="text-foreground">{fmtDate(ticket.work_started_at)}</span></div>
          <div><span className="text-muted-foreground">Closed:</span> <span className="text-foreground">{fmtDate(ticket.closed_at)}</span></div>
        </div>
      </div>

      {/* Photos by Stage */}
      {['start', 'process', 'close'].map((stage) => {
        const stagePhotos = photosByStage(stage);
        if (stagePhotos.length === 0) return null;
        return (
          <div key={stage} className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground capitalize">{stage} Photos</h2>
            <div className="grid grid-cols-2 gap-2">
              {stagePhotos.map((p) => (
                <Dialog key={p.id} open={zoomPhoto === p.id} onOpenChange={(open) => setZoomPhoto(open ? p.id : null)}>
                  <DialogTrigger asChild>
                    <img
                      src={p.url || ''}
                      alt={`${stage} photo`}
                      className="w-full h-32 object-cover rounded-md border border-border cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  </DialogTrigger>
                  <DialogContent className="max-w-[90vw] max-h-[90vh] p-2">
                    <img src={p.url || ''} alt={`${stage} photo zoomed`} className="w-full h-full object-contain" />
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          </div>
        );
      })}

      {/* Billing Fields (Editable) */}
      {canEdit && (
        <div className="rounded-lg border border-primary/30 bg-card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-primary">Billing</h2>
          <div>
            <Label>Billing Status</Label>
            <Select value={billingStatus} onValueChange={setBillingStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="invoiced">Invoiced</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>QB Invoice Number</Label>
            <Input value={qbInvoice} onChange={(e) => setQbInvoice(e.target.value)} placeholder="e.g. INV-12345" />
          </div>
          <div>
            <Label>Accounting Notes</Label>
            <Textarea value={accountingNotes} onChange={(e) => setAccountingNotes(e.target.value)} rows={3} />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Billing Info'}
            </Button>
            <Button variant="outline" onClick={() => toast.info('Exporting PDF...')}>
              <FileDown className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountingDetail;
