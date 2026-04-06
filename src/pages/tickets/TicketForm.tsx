import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';

const TicketForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);

  const [form, setForm] = useState({
    client_id: '',
    property_id: '',
    zone_id: '',
    unit: '',
    work_type: 'repair',
    priority: 'normal',
    technician_id: '',
    appointment_time: '',
    description: '',
    internal_note: '',
    quote_reference: '',
  });

  useEffect(() => {
    const fetchOptions = async () => {
      const [cRes, pRes, zRes, uRes] = await Promise.all([
        supabase.from('clients').select('id, company_name').eq('status', 'active'),
        supabase.from('properties').select('id, name, zone_id, current_pm_id').eq('status', 'active'),
        supabase.from('zones').select('id, name').eq('status', 'active'),
        supabase.from('users').select('id, full_name, roles').filter('roles', 'cs', '{"technician"}'),
      ]);
      setClients(cRes.data ?? []);
      setProperties(pRes.data ?? []);
      setZones(zRes.data ?? []);
      setTechnicians(uRes.data ?? []);
    };
    fetchOptions();

    if (isEdit) {
      setLoading(true);
      supabase.from('tickets').select('*').eq('id', id).single().then(({ data }) => {
        if (data) {
          setForm({
            client_id: data.client_id ?? '',
            property_id: data.property_id ?? '',
            zone_id: data.zone_id ?? '',
            unit: data.unit ?? '',
            work_type: data.work_type ?? 'repair',
            priority: data.priority ?? 'normal',
            technician_id: data.technician_id ?? '',
            appointment_time: data.appointment_time ? new Date(data.appointment_time).toISOString().slice(0, 16) : '',
            description: data.description ?? '',
            internal_note: data.internal_note ?? '',
            quote_reference: data.quote_reference ?? '',
          });
        }
        setLoading(false);
      });
    }
  }, [id, isEdit]);

  // Auto-fill zone and PM when property selected
  useEffect(() => {
    if (form.property_id) {
      const prop = properties.find(p => p.id === form.property_id);
      if (prop) {
        setForm(prev => ({
          ...prev,
          zone_id: prop.zone_id ?? prev.zone_id,
          client_id: prop.current_pm_id ?? prev.client_id,
        }));
      }
    }
  }, [form.property_id, properties]);

  const handleSubmit = async (asDraft = false) => {
    setSaving(true);
    try {
      // Generate FS number for new tickets
      let fsNumber: string | undefined;
      if (!isEdit) {
        const { data } = await supabase.rpc('generate_fs_number');
        fsNumber = data as string;
      }

      const payload: any = {
        ...form,
        client_id: form.client_id || null,
        property_id: form.property_id || null,
        zone_id: form.zone_id || null,
        technician_id: form.technician_id || null,
        appointment_time: form.appointment_time || null,
        status: asDraft ? 'draft' : (isEdit ? undefined : 'open'),
      };

      if (!isEdit) {
        payload.fs_number = fsNumber;
      }

      if (isEdit) {
        delete payload.status; // Don't change status on edit
        await supabase.from('tickets').update(payload).eq('id', id);
        toast.success('Ticket updated');
      } else {
        await supabase.from('tickets').insert(payload);
        toast.success(asDraft ? 'Draft saved' : 'Ticket created');
      }
      navigate('/tickets');
    } catch {
      toast.error('Error saving ticket');
    }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-foreground">{isEdit ? 'Edit Ticket' : 'New Ticket'}</h1>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Work Type</Label>
            <Select value={form.work_type} onValueChange={v => setForm(p => ({ ...p, work_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="make-ready">Make-Ready</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
                <SelectItem value="repair">Repair</SelectItem>
                <SelectItem value="capex">CapEx</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Property</Label>
          <Select value={form.property_id} onValueChange={v => setForm(p => ({ ...p, property_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
            <SelectContent>
              {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Client / PM</Label>
            <Select value={form.client_id} onValueChange={v => setForm(p => ({ ...p, client_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Zone</Label>
            <Select value={form.zone_id} onValueChange={v => setForm(p => ({ ...p, zone_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
              <SelectContent>
                {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Unit</Label>
            <Input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} placeholder="e.g. Apt 201" />
          </div>
          <div>
            <Label>Technician</Label>
            <Select value={form.technician_id} onValueChange={v => setForm(p => ({ ...p, technician_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Assign technician" /></SelectTrigger>
              <SelectContent>
                {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Appointment Time</Label>
          <Input type="datetime-local" value={form.appointment_time} onChange={e => setForm(p => ({ ...p, appointment_time: e.target.value }))} />
        </div>

        <div>
          <Label>Description</Label>
          <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Describe the work needed..." />
        </div>

        <div>
          <Label>Internal Note</Label>
          <Textarea value={form.internal_note} onChange={e => setForm(p => ({ ...p, internal_note: e.target.value }))} rows={2} placeholder="Internal notes (not visible to technicians)" />
        </div>

        <div>
          <Label>Quote Reference</Label>
          <Input value={form.quote_reference} onChange={e => setForm(p => ({ ...p, quote_reference: e.target.value }))} placeholder="Quote or PO number" />
        </div>

        <div className="flex gap-3 pt-4">
          {!isEdit && (
            <Button variant="outline" className="flex-1" onClick={() => handleSubmit(true)} disabled={saving}>
              Save as Draft
            </Button>
          )}
          <Button className="flex-1" onClick={() => handleSubmit(false)} disabled={saving}>
            {saving ? <Spinner size="sm" /> : (isEdit ? 'Update Ticket' : 'Create Ticket')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TicketForm;
