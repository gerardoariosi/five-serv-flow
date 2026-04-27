import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Camera, FileText, AlertTriangle, X } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';

const TEMPLATES = [
  { label: 'Make-Ready Standard', work_type: 'make-ready', priority: 'normal', description: 'Full make-ready service: paint, clean, minor repairs, appliance check.' },
  { label: 'Emergency Plumbing', work_type: 'emergency', priority: 'urgent', description: 'Emergency plumbing issue. Requires immediate attention.' },
  { label: 'Routine Repair', work_type: 'repair', priority: 'normal', description: 'Standard repair request.' },
  { label: 'Capital Expenditure', work_type: 'capex', priority: 'normal', description: 'Capital improvement project. Quote required before work begins.' },
];

const TicketForm = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isEdit = !!id;
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftId = useRef<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [workTypes, setWorkTypes] = useState<{ key: string; label: string }[]>([]);
  const [initialPhotos, setInitialPhotos] = useState<File[]>([]);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<any>(null);
  const [showTemplates, setShowTemplates] = useState(false);

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
    related_inspection_id: '',
  });

  // Fetch options
  useEffect(() => {
    const fetchOptions = async () => {
      const [cRes, pRes, zRes, uRes, iRes, wtRes] = await Promise.all([
        supabase.from('clients').select('id, company_name').eq('status', 'active'),
        supabase.from('properties').select('id, name, address, zone_id, current_pm_id').eq('status', 'active'),
        supabase.from('zones').select('id, name').eq('status', 'active'),
        supabase.from('users').select('id, full_name, roles').filter('roles', 'cs', '{"technician"}'),
        supabase.from('inspections').select('id, ins_number, property_id').in('status', ['draft', 'pending']),
        supabase.from('work_types').select('key, label'),
      ]);
      setClients(cRes.data ?? []);
      setProperties(pRes.data ?? []);
      setZones(zRes.data ?? []);
      setTechnicians(uRes.data ?? []);
      setInspections(iRes.data ?? []);
      setWorkTypes((wtRes.data ?? []).length > 0 ? wtRes.data! : [
        { key: 'make-ready', label: 'Make-Ready' },
        { key: 'emergency', label: 'Emergency' },
        { key: 'repair', label: 'Repair' },
        { key: 'capex', label: 'CapEx' },
      ]);
    };
    fetchOptions();
  }, []);

  // Load existing ticket for edit, or check for existing draft
  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      supabase.from('tickets').select('*').eq('id', id).maybeSingle().then(({ data, error }) => {
        if (error || !data) {
          toast.error(error?.message || 'Ticket not found');
          setLoading(false);
          navigate('/tickets', { replace: true });
          return;
        }
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
          related_inspection_id: data.related_inspection_id ?? '',
        });
        setLoading(false);
      });
    } else {
      // Check for auto-saved drafts
      supabase.from('tickets')
        .select('*')
        .eq('status', 'draft')
        .eq('is_draft_auto_saved', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setPendingDraft(data[0]);
            setShowDraftPrompt(true);
          }
        });

      // Pre-fill from search params (e.g. from property detail)
      const propId = searchParams.get('property_id');
      if (propId) {
        setForm(prev => ({ ...prev, property_id: propId }));
      }
    }
  }, [id, isEdit, searchParams]);

  // Auto-fill zone and PM when property selected
  useEffect(() => {
    if (form.property_id && properties.length > 0) {
      const prop = properties.find((p: any) => p.id === form.property_id);
      if (prop) {
        setForm(prev => ({
          ...prev,
          zone_id: prop.zone_id ?? prev.zone_id,
          client_id: prop.current_pm_id ?? prev.client_id,
        }));
      }
    }
  }, [form.property_id, properties]);

  // Auto-save draft after 10 seconds of inactivity
  const scheduleAutoSave = useCallback(() => {
    if (isEdit) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      if (!form.description && !form.property_id && !form.client_id) return;
      const payload: any = {
        ...form,
        client_id: form.client_id || null,
        property_id: form.property_id || null,
        zone_id: form.zone_id || null,
        technician_id: form.technician_id || null,
        appointment_time: form.appointment_time || null,
        related_inspection_id: form.related_inspection_id || null,
        status: 'draft',
        is_draft_auto_saved: true,
      };
      if (draftId.current) {
        await supabase.from('tickets').update(payload).eq('id', draftId.current);
      } else {
        const { data } = await supabase.rpc('generate_fs_number');
        payload.fs_number = data as string;
        const { data: inserted } = await supabase.from('tickets').insert(payload).select('id').single();
        if (inserted) draftId.current = inserted.id;
      }
    }, 10000);
  }, [form, isEdit]);

  useEffect(() => {
    scheduleAutoSave();
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [form, scheduleAutoSave]);

  const continueDraft = () => {
    if (!pendingDraft) return;
    draftId.current = pendingDraft.id;
    setForm({
      client_id: pendingDraft.client_id ?? '',
      property_id: pendingDraft.property_id ?? '',
      zone_id: pendingDraft.zone_id ?? '',
      unit: pendingDraft.unit ?? '',
      work_type: pendingDraft.work_type ?? 'repair',
      priority: pendingDraft.priority ?? 'normal',
      technician_id: pendingDraft.technician_id ?? '',
      appointment_time: pendingDraft.appointment_time ? new Date(pendingDraft.appointment_time).toISOString().slice(0, 16) : '',
      description: pendingDraft.description ?? '',
      internal_note: pendingDraft.internal_note ?? '',
      quote_reference: pendingDraft.quote_reference ?? '',
      related_inspection_id: pendingDraft.related_inspection_id ?? '',
    });
    setShowDraftPrompt(false);
  };

  const discardDraft = async () => {
    if (pendingDraft) {
      await supabase.from('tickets').delete().eq('id', pendingDraft.id);
    }
    setShowDraftPrompt(false);
  };

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    setForm(prev => ({
      ...prev,
      work_type: template.work_type,
      priority: template.priority,
      description: template.description,
    }));
    setShowTemplates(false);
    toast.success(`Template "${template.label}" applied`);
  };

  const filteredProperties = form.zone_id
    ? properties.filter((p: any) => p.zone_id === form.zone_id)
    : properties;

  const handleSubmit = async (asDraft = false) => {
    // Validate emergency requires technician
    if (!asDraft && form.work_type === 'emergency' && !form.technician_id) {
      toast.error('Emergency tickets require an assigned technician');
      return;
    }

    if (form.description.length > 5000) {
      toast.error('Description must be 5000 characters or less');
      return;
    }

    setSaving(true);
    try {
      let fsNumber: string | undefined;
      if (!isEdit && !draftId.current) {
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
        related_inspection_id: form.related_inspection_id || null,
        status: asDraft ? 'draft' : 'open',
        is_draft_auto_saved: asDraft,
      };

      let ticketId: string;

      if (isEdit) {
        delete payload.status;
        delete payload.is_draft_auto_saved;
        const { error: updErr } = await supabase.from('tickets').update(payload).eq('id', id);
        if (updErr) throw updErr;
        ticketId = id!;
        toast.success('Ticket updated');
      } else if (draftId.current) {
        // Update existing draft
        if (!asDraft) payload.is_draft_auto_saved = false;
        const { error: updErr } = await supabase.from('tickets').update(payload).eq('id', draftId.current);
        if (updErr) throw updErr;
        ticketId = draftId.current;
        toast.success(asDraft ? 'Draft saved' : 'Ticket created');
      } else {
        payload.fs_number = fsNumber;
        const { data: inserted, error: insErr } = await supabase.from('tickets').insert(payload).select('id').single();
        if (insErr) throw insErr;
        ticketId = inserted!.id;
        toast.success(asDraft ? 'Draft saved' : 'Ticket created');
      }

      // Upload initial photos
      if (initialPhotos.length > 0) {
        for (const file of initialPhotos) {
          const path = `${ticketId}/${Date.now()}-${file.name}`;
          const { error: upErr } = await supabase.storage.from('ticket-photos').upload(path, file);
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from('ticket-photos').getPublicUrl(path);
            await supabase.from('ticket_photos').insert({
              ticket_id: ticketId,
              url: publicUrl,
              stage: 'initial',
              technician_id: user?.id ?? null,
            });
          }
        }
      }

      // Email the technician if newly assigned
      if (!asDraft && form.technician_id) {
        try {
          const tech = technicians.find((t: any) => t.id === form.technician_id);
          const { data: techUser } = await supabase
            .from('users').select('email, full_name').eq('id', form.technician_id).single();
          const prop = properties.find((p: any) => p.id === form.property_id);
          if (techUser?.email) {
            await supabase.functions.invoke('send-business-email', {
              body: {
                template_name: 'technician_assigned',
                to_email: techUser.email,
                variables: {
                  fs_number: fsNumber ?? '',
                  property_name: prop?.name ?? '',
                  property_address: prop?.address ?? '',
                  unit: form.unit ?? '',
                  work_type: (form.work_type ?? '').replace('-', ' '),
                  job_description: form.description ?? '',
                  appointment_date: form.appointment_time
                    ? new Date(form.appointment_time).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Not scheduled',
                  appointment_time: form.appointment_time
                    ? new Date(form.appointment_time).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
                    : '',
                  technician_name: techUser?.full_name ?? tech?.full_name ?? '',
                  app_url: `https://app.fiveserv.net/tickets/${ticketId}`,
                  directions_url: prop?.address
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prop.address)}`
                    : '',
                },
              },
            });
          }
        } catch {
          // non-blocking
        }
      }

      navigate('/tickets');
    } catch (err: any) {
      console.error('Ticket save error:', err);
      toast.error(err?.message || err?.error?.message || 'Error saving ticket');
    }
    setSaving(false);
  };

  const addPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setInitialPhotos(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setInitialPhotos(prev => prev.filter((_, i) => i !== index));
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      {/* Draft prompt */}
      <Dialog open={showDraftPrompt} onOpenChange={setShowDraftPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Continue draft?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You have an unsaved draft ticket ({pendingDraft?.fs_number}). Would you like to continue editing or discard it?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="destructive" onClick={discardDraft}>Discard</Button>
            <Button onClick={continueDraft}>Continue Draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template picker */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Use Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {TEMPLATES.map((t, i) => (
              <button
                key={i}
                onClick={() => applyTemplate(t)}
                className="w-full text-left p-3 rounded-lg border border-border hover:bg-secondary transition-colors"
              >
                <span className="font-medium text-foreground text-sm">{t.label}</span>
                <p className="text-xs text-muted-foreground mt-1 truncate">{t.description}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-foreground">{isEdit ? 'Edit Ticket' : 'New Ticket'}</h1>
        </div>
        {!isEdit && (
          <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)}>
            <FileText className="w-4 h-4 mr-1" /> Use Template
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {/* Work Type + Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Work Type</Label>
            <Select value={form.work_type} onValueChange={v => setForm(p => ({ ...p, work_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {workTypes.map(wt => (
                  <SelectItem key={wt.key} value={wt.key}>{wt.label}</SelectItem>
                ))}
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

        {/* Client + Zone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Client / PM</Label>
            <Select value={form.client_id} onValueChange={v => setForm(p => ({ ...p, client_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Zone</Label>
            <Select value={form.zone_id} onValueChange={v => setForm(p => ({ ...p, zone_id: v, property_id: '' }))}>
              <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
              <SelectContent>
                {zones.map((z: any) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Property (filtered by zone) */}
        <div>
          <Label>Property</Label>
          <Select value={form.property_id} onValueChange={v => setForm(p => ({ ...p, property_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
            <SelectContent>
              {filteredProperties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Unit + Technician */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Unit</Label>
            <Input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} placeholder="e.g. Apt 201" />
          </div>
          <div>
            <Label className="flex items-center gap-1">
              Technician
              {form.work_type === 'emergency' && <span className="text-destructive text-xs">*required</span>}
            </Label>
            <Select value={form.technician_id} onValueChange={v => setForm(p => ({ ...p, technician_id: v }))}>
              <SelectTrigger className={form.work_type === 'emergency' && !form.technician_id ? 'border-destructive' : ''}>
                <SelectValue placeholder="Assign technician" />
              </SelectTrigger>
              <SelectContent>
                {technicians.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Emergency alert */}
        {form.work_type === 'emergency' && !form.technician_id && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/30">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <span className="text-xs text-destructive">Emergency tickets require an assigned technician before submission.</span>
          </div>
        )}

        {/* Appointment Time */}
        <div>
          <Label>Appointment Time</Label>
          <Input type="datetime-local" value={form.appointment_time} onChange={e => setForm(p => ({ ...p, appointment_time: e.target.value }))} />
        </div>

        {/* Description */}
        <div>
          <Label>Description <span className="text-muted-foreground text-xs">({form.description.length}/5000)</span></Label>
          <Textarea
            value={form.description}
            onChange={e => { if (e.target.value.length <= 5000) setForm(p => ({ ...p, description: e.target.value })); }}
            rows={4}
            placeholder="Describe the work needed..."
          />
        </div>

        {/* Internal Note */}
        <div>
          <Label className="text-muted-foreground">Internal Note <span className="text-xs">(not visible to PM or technician)</span></Label>
          <Textarea value={form.internal_note} onChange={e => setForm(p => ({ ...p, internal_note: e.target.value }))} rows={2} placeholder="Internal notes..." />
        </div>

        {/* Quote Reference — CapEx only */}
        {form.work_type === 'capex' && (
          <div>
            <Label>Quote Reference #</Label>
            <Input value={form.quote_reference} onChange={e => setForm(p => ({ ...p, quote_reference: e.target.value }))} placeholder="Quote or PO number" />
          </div>
        )}

        {/* Related Inspection */}
        <div>
          <Label>Related Inspection</Label>
          <Select value={form.related_inspection_id || 'none'} onValueChange={v => setForm(p => ({ ...p, related_inspection_id: v === 'none' ? '' : v }))}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {inspections.map((ins: any) => <SelectItem key={ins.id} value={ins.id}>{ins.ins_number ?? ins.id.slice(0, 8)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Initial Photos */}
        <div>
          <Label>Initial Photos (optional)</Label>
          <label className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:bg-secondary transition-colors mt-1">
            <Camera className="w-5 h-5 text-primary" />
            <span className="text-sm text-muted-foreground">Add Photos</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={addPhoto} />
          </label>
          {initialPhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {initialPhotos.map((f, i) => (
                <div key={i} className="relative rounded-lg overflow-hidden border border-border">
                  <img src={URL.createObjectURL(f)} alt="" className="w-full h-20 object-cover" />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 p-0.5 bg-background/80 rounded-full"
                  >
                    <X className="w-3 h-3 text-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
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
