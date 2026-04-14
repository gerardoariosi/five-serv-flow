import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Spinner from '@/components/ui/Spinner';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Power, Download, Upload, Key, Globe, FileText, Tag, Wrench, ClipboardList, MapPin, Calendar, Building2 } from 'lucide-react';

// ─── Specialties Section ───
const SpecialtiesSection = () => {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; mode: 'create' | 'edit'; id?: string; name: string }>({ open: false, mode: 'create', name: '' });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string; name: string; techs: string[] }>({ open: false, id: '', name: '', techs: [] });

  const { data: specialties, isLoading } = useQuery({
    queryKey: ['specialties'],
    queryFn: async () => {
      const { data, error } = await supabase.from('specialties').select('*').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (dialog.mode === 'create') {
        const { error } = await supabase.from('specialties').insert({ name: dialog.name });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('specialties').update({ name: dialog.name }).eq('id', dialog.id!);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['specialties'] }); toast.success('Saved.'); setDialog({ open: false, mode: 'create', name: '' }); },
    onError: () => toast.error('Failed to save.'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('specialties').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['specialties'] }); toast.success('Specialty deleted.'); setDeleteDialog({ open: false, id: '', name: '', techs: [] }); },
    onError: () => toast.error('Failed to delete.'),
  });

  const handleDelete = async (id: string, name: string) => {
    const { data: techs } = await supabase.from('technicians_vendors').select('contact_name, specialties').eq('type', 'technician');
    const affected = (techs ?? []).filter(t => t.specialties?.includes(name)).map(t => t.contact_name ?? 'Unknown');
    setDeleteDialog({ open: true, id, name, techs: affected });
  };

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Specialties</h3>
        <Button size="sm" onClick={() => setDialog({ open: true, mode: 'create', name: '' })} className="bg-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1" />Add</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {specialties?.map(s => (
          <Badge key={s.id} variant="secondary" className="flex items-center gap-1 px-3 py-1.5">
            {s.name}
            <button onClick={() => setDialog({ open: true, mode: 'edit', id: s.id, name: s.name })} className="ml-1 text-muted-foreground hover:text-foreground"><Edit className="w-3 h-3" /></button>
            <button onClick={() => handleDelete(s.id, s.name)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
          </Badge>
        ))}
        {specialties?.length === 0 && <p className="text-sm text-muted-foreground">No specialties yet.</p>}
      </div>

      <Dialog open={dialog.open} onOpenChange={o => setDialog(p => ({ ...p, open: o }))}>
        <DialogContent><DialogHeader><DialogTitle>{dialog.mode === 'create' ? 'Add Specialty' : 'Edit Specialty'}</DialogTitle></DialogHeader>
          <Input value={dialog.name} onChange={e => setDialog(p => ({ ...p, name: e.target.value }))} placeholder="Specialty name" className="bg-secondary border-border" />
          <DialogFooter><Button onClick={() => saveMutation.mutate()} disabled={!dialog.name || saveMutation.isPending} className="bg-primary text-primary-foreground">{saveMutation.isPending ? <Spinner size="sm" /> : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialog.open} onOpenChange={o => setDeleteDialog(p => ({ ...p, open: o }))}>
        <DialogContent><DialogHeader><DialogTitle>Delete "{deleteDialog.name}"?</DialogTitle></DialogHeader>
          {deleteDialog.techs.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">The following technicians will be logged out immediately:</p>
              <ul className="text-sm text-foreground list-disc pl-4">{deleteDialog.techs.map((t, i) => <li key={i}>{t}</li>)}</ul>
              <p className="text-xs text-muted-foreground">Their active tickets will stay assigned.</p>
            </div>
          ) : <p className="text-sm text-muted-foreground">No technicians are affected.</p>}
          <DialogFooter><Button variant="destructive" onClick={() => deleteMutation.mutate(deleteDialog.id)} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? <Spinner size="sm" /> : 'Delete'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Work Types Section ───
const WorkTypesSection = () => {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; mode: 'create' | 'edit'; id?: string; label: string; key: string }>({ open: false, mode: 'create', label: '', key: '' });

  const { data: types, isLoading } = useQuery({
    queryKey: ['work_types'],
    queryFn: async () => { const { data, error } = await supabase.from('work_types').select('*').order('label'); if (error) throw error; return data ?? []; },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (dialog.mode === 'create') {
        const { error } = await supabase.from('work_types').insert({ label: dialog.label, key: dialog.key.toLowerCase().replace(/\s+/g, '_') });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('work_types').update({ label: dialog.label }).eq('id', dialog.id!);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['work_types'] }); toast.success('Saved.'); setDialog({ open: false, mode: 'create', label: '', key: '' }); },
    onError: () => toast.error('Failed to save.'),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Work Types</h3>
        <Button size="sm" onClick={() => setDialog({ open: true, mode: 'create', label: '', key: '' })} className="bg-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1" />Add</Button>
      </div>
      <div className="flex flex-col gap-2">
        {types?.map(t => (
          <div key={t.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
            <div><span className="font-medium text-foreground">{t.label}</span><span className="text-xs text-muted-foreground ml-2">({t.key})</span></div>
            <button onClick={() => setDialog({ open: true, mode: 'edit', id: t.id, label: t.label, key: t.key })} className="p-2 text-muted-foreground hover:text-foreground"><Edit className="w-4 h-4" /></button>
          </div>
        ))}
      </div>

      <Dialog open={dialog.open} onOpenChange={o => setDialog(p => ({ ...p, open: o }))}>
        <DialogContent><DialogHeader><DialogTitle>{dialog.mode === 'create' ? 'Add Work Type' : 'Edit Work Type'}</DialogTitle></DialogHeader>
          <Input value={dialog.label} onChange={e => setDialog(p => ({ ...p, label: e.target.value }))} placeholder="Label" className="bg-secondary border-border" />
          {dialog.mode === 'create' && <Input value={dialog.key} onChange={e => setDialog(p => ({ ...p, key: e.target.value }))} placeholder="Key (e.g. make_ready)" className="bg-secondary border-border" />}
          <DialogFooter><Button onClick={() => saveMutation.mutate()} disabled={!dialog.label || saveMutation.isPending} className="bg-primary text-primary-foreground">{saveMutation.isPending ? <Spinner size="sm" /> : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Email Templates Section ───
const EmailTemplatesSection = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ id: string; subject: string; body: string } | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['email_templates'],
    queryFn: async () => { const { data, error } = await supabase.from('email_templates').select('*').order('template_key'); if (error) throw error; return data ?? []; },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase.from('email_templates').update({ subject: editing.subject, body: editing.body, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['email_templates'] }); toast.success('Template saved.'); setEditing(null); },
    onError: () => toast.error('Failed to save.'),
  });

  const templateLabels: Record<string, string> = { ticket_created: 'Ticket Created (to PM)', ready_for_review: 'Ready for Review (to Admin)', reset_password: 'Reset Password', weekly_summary: 'Weekly Summary' };

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;

  return (
    <div>
      <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">Email Templates</h3>
      <div className="flex flex-col gap-3">
        {templates?.map(t => (
          <div key={t.id} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-foreground">{templateLabels[t.template_key] ?? t.template_key}</span>
              <button onClick={() => setEditing({ id: t.id, subject: t.subject ?? '', body: t.body ?? '' })} className="p-1 text-muted-foreground hover:text-foreground"><Edit className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground">Subject: {t.subject}</p>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={o => { if (!o) setEditing(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Edit Template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs text-muted-foreground">Subject</label><Input value={editing?.subject ?? ''} onChange={e => setEditing(p => p ? { ...p, subject: e.target.value } : p)} className="bg-secondary border-border" /></div>
            <div><label className="text-xs text-muted-foreground">Body</label><Textarea value={editing?.body ?? ''} onChange={e => setEditing(p => p ? { ...p, body: e.target.value } : p)} rows={6} className="bg-secondary border-border" /></div>
            <p className="text-xs text-muted-foreground">Variables: {'{{fs_number}}, {{property}}, {{link}}'}</p>
          </div>
          <DialogFooter><Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-primary text-primary-foreground">{saveMutation.isPending ? <Spinner size="sm" /> : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Inspection Items Section ───
const InspectionItemsSection = () => {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; mode: 'create' | 'edit'; id?: string; area: string; item_name: string; default_price: string }>({ open: false, mode: 'create', area: '', item_name: '', default_price: '0' });

  const { data: items, isLoading } = useQuery({
    queryKey: ['inspection_item_defaults'],
    queryFn: async () => { const { data, error } = await supabase.from('inspection_item_defaults').select('*').order('area').order('item_name'); if (error) throw error; return data ?? []; },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { area: dialog.area, item_name: dialog.item_name, default_price: parseFloat(dialog.default_price) || 0 };
      if (dialog.mode === 'create') { const { error } = await supabase.from('inspection_item_defaults').insert(payload); if (error) throw error; }
      else { const { error } = await supabase.from('inspection_item_defaults').update(payload).eq('id', dialog.id!); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inspection_item_defaults'] }); toast.success('Saved.'); setDialog({ open: false, mode: 'create', area: '', item_name: '', default_price: '0' }); },
    onError: () => toast.error('Failed to save.'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('inspection_item_defaults').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inspection_item_defaults'] }); toast.success('Deleted.'); },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;

  const grouped = (items ?? []).reduce<Record<string, typeof items>>((acc, item) => { const a = item.area ?? 'Other'; if (!acc[a]) acc[a] = []; acc[a]!.push(item); return acc; }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Inspection Item Defaults</h3>
        <Button size="sm" onClick={() => setDialog({ open: true, mode: 'create', area: '', item_name: '', default_price: '0' })} className="bg-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1" />Add</Button>
      </div>
      {Object.entries(grouped).map(([area, areaItems]) => (
        <div key={area} className="mb-4">
          <h4 className="text-xs text-muted-foreground uppercase mb-2">{area}</h4>
          <div className="flex flex-col gap-1">
            {areaItems?.map(item => (
              <div key={item.id} className="bg-card border border-border rounded p-3 flex items-center justify-between">
                <div><span className="text-sm text-foreground">{item.item_name}</span><span className="text-xs text-muted-foreground ml-2">${item.default_price}</span></div>
                <div className="flex gap-1">
                  <button onClick={() => setDialog({ open: true, mode: 'edit', id: item.id, area: item.area, item_name: item.item_name, default_price: String(item.default_price ?? 0) })} className="p-1 text-muted-foreground hover:text-foreground"><Edit className="w-3 h-3" /></button>
                  <button onClick={() => deleteMutation.mutate(item.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {Object.keys(grouped).length === 0 && <p className="text-sm text-muted-foreground">No default items.</p>}

      <Dialog open={dialog.open} onOpenChange={o => setDialog(p => ({ ...p, open: o }))}>
        <DialogContent><DialogHeader><DialogTitle>{dialog.mode === 'create' ? 'Add Item' : 'Edit Item'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={dialog.area} onChange={e => setDialog(p => ({ ...p, area: e.target.value }))} placeholder="Area (e.g. Kitchen)" className="bg-secondary border-border" />
            <Input value={dialog.item_name} onChange={e => setDialog(p => ({ ...p, item_name: e.target.value }))} placeholder="Item name" className="bg-secondary border-border" />
            <Input type="number" value={dialog.default_price} onChange={e => setDialog(p => ({ ...p, default_price: e.target.value }))} placeholder="Default price" className="bg-secondary border-border" />
          </div>
          <DialogFooter><Button onClick={() => saveMutation.mutate()} disabled={!dialog.area || !dialog.item_name || saveMutation.isPending} className="bg-primary text-primary-foreground">{saveMutation.isPending ? <Spinner size="sm" /> : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Zones Section (embedded) ───
const ZonesSection = () => {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; mode: 'create' | 'rename'; zoneId?: string; name: string }>({ open: false, mode: 'create', name: '' });

  const { data: zones, isLoading } = useQuery({
    queryKey: ['zones'],
    queryFn: async () => {
      const { data: z, error } = await supabase.from('zones').select('*').order('name');
      if (error) throw error;
      return z ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (dialog.mode === 'create') { const { error } = await supabase.from('zones').insert({ name: dialog.name }); if (error) throw error; }
      else { const { error } = await supabase.from('zones').update({ name: dialog.name }).eq('id', dialog.zoneId!); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones'] }); toast.success('Saved.'); setDialog({ open: false, mode: 'create', name: '' }); },
    onError: () => toast.error('Failed.'),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ zoneId, currentStatus }: { zoneId: string; currentStatus: string }) => {
      if (currentStatus === 'active') {
        const { data: tickets } = await supabase.from('tickets').select('id').eq('zone_id', zoneId).not('status', 'in', '("closed","cancelled")').limit(1);
        if (tickets && tickets.length > 0) throw new Error('active_tickets');
      }
      const { error } = await supabase.from('zones').update({ status: currentStatus === 'active' ? 'inactive' : 'active' }).eq('id', zoneId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones'] }); toast.success('Updated.'); },
    onError: (err: Error) => toast.error(err.message === 'active_tickets' ? 'Zone has active tickets.' : 'Failed.'),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Zones</h3>
        <Button size="sm" onClick={() => setDialog({ open: true, mode: 'create', name: '' })} className="bg-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1" />Add</Button>
      </div>
      <div className="flex flex-col gap-2">
        {zones?.map(z => (
          <div key={z.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
            <div><span className="font-medium text-foreground">{z.name}</span><Badge variant={z.status === 'active' ? 'default' : 'secondary'} className="ml-2 text-xs">{z.status}</Badge></div>
            <div className="flex gap-1">
              <button onClick={() => setDialog({ open: true, mode: 'rename', zoneId: z.id, name: z.name ?? '' })} className="p-2 text-muted-foreground hover:text-foreground"><Edit className="w-4 h-4" /></button>
              <button onClick={() => toggleMutation.mutate({ zoneId: z.id, currentStatus: z.status ?? 'active' })} className="p-2 text-muted-foreground hover:text-foreground"><Power className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialog.open} onOpenChange={o => setDialog(p => ({ ...p, open: o }))}>
        <DialogContent><DialogHeader><DialogTitle>{dialog.mode === 'create' ? 'New Zone' : 'Rename Zone'}</DialogTitle></DialogHeader>
          <Input value={dialog.name} onChange={e => setDialog(p => ({ ...p, name: e.target.value }))} placeholder="Zone name" className="bg-secondary border-border" />
          <DialogFooter><Button onClick={() => saveMutation.mutate()} disabled={!dialog.name || saveMutation.isPending} className="bg-primary text-primary-foreground">{saveMutation.isPending ? <Spinner size="sm" /> : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Master PIN Section ───
const MasterPinSection = () => {
  const qc = useQueryClient();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const { data: pinData, isLoading } = useQuery({
    queryKey: ['master_pin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('master_pin').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const isDefault = !pinData || pinData.pin === '0000';

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!isDefault && currentPin !== pinData?.pin) throw new Error('wrong_pin');
      if (newPin !== confirmPin) throw new Error('mismatch');
      if (newPin.length < 4) throw new Error('too_short');

      if (pinData?.id) {
        const { error } = await supabase
          .from('master_pin')
          .update({ pin: newPin, updated_at: new Date().toISOString() })
          .eq('id', pinData.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('master_pin').insert({ pin: newPin });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['master_pin'] });
      toast.success(isDefault ? 'PIN set successfully.' : 'PIN updated.');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    },
    onError: (err: Error) => {
      if (err.message === 'wrong_pin') toast.error('Current PIN is incorrect.');
      else if (err.message === 'mismatch') toast.error('PINs do not match.');
      else if (err.message === 'too_short') toast.error('PIN must be at least 4 digits.');
      else if (err.message?.includes('row-level security') || err.message?.includes('policy'))
        toast.error('Your account does not have permission to update the Master PIN.');
      else toast.error('Failed to update PIN. Check your permissions.');
    },
  });

  if (isLoading) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">Master PIN</h3>
        <p className="text-xs text-muted-foreground mb-4">This PIN is used to access all PM portals.</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size="sm" />
          <span>Loading PIN settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">Master PIN</h3>
      <p className="text-xs text-muted-foreground mb-4">This PIN is used to access all PM portals.</p>
      {isDefault && <p className="text-xs text-muted-foreground mb-3">No PIN configured yet. Set your first PIN below.</p>}
      <div className="space-y-3 max-w-xs">
        {!isDefault && <Input type="password" value={currentPin} onChange={e => setCurrentPin(e.target.value)} placeholder="Current PIN" className="bg-secondary border-border" />}
        <Input type="password" value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="New PIN" className="bg-secondary border-border" />
        <Input type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} placeholder="Confirm New PIN" className="bg-secondary border-border" />
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-primary text-primary-foreground">{saveMutation.isPending ? <Spinner size="sm" /> : isDefault ? 'Set PIN' : 'Update PIN'}</Button>
      </div>
    </div>
  );
};

// ─── Holidays Section ───
const HolidaysSection = () => {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; mode: 'create' | 'edit'; id?: string; name: string; date: string; is_federal: boolean }>({ open: false, mode: 'create', name: '', date: '', is_federal: true });

  const { data: holidays, isLoading } = useQuery({
    queryKey: ['holidays'],
    queryFn: async () => { const { data, error } = await supabase.from('holidays').select('*').order('date'); if (error) throw error; return data ?? []; },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { name: dialog.name, date: dialog.date, is_federal: dialog.is_federal };
      if (dialog.mode === 'create') { const { error } = await supabase.from('holidays').insert(payload); if (error) throw error; }
      else { const { error } = await supabase.from('holidays').update(payload).eq('id', dialog.id!); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holidays'] }); toast.success('Saved.'); setDialog({ open: false, mode: 'create', name: '', date: '', is_federal: true }); },
    onError: () => toast.error('Failed.'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('holidays').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holidays'] }); toast.success('Deleted.'); },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Holidays</h3>
        <Button size="sm" onClick={() => setDialog({ open: true, mode: 'create', name: '', date: '', is_federal: true })} className="bg-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1" />Add</Button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">Holidays pause the 5-day make-ready countdown. Auto-resumes next business day at 9 AM ET.</p>
      <div className="flex flex-col gap-2">
        {holidays?.map(h => (
          <div key={h.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
            <div><span className="font-medium text-foreground">{h.name}</span><span className="text-xs text-muted-foreground ml-2">{h.date}</span>{h.is_federal && <Badge className="ml-2 text-xs">Federal</Badge>}</div>
            <div className="flex gap-1">
              <button onClick={() => setDialog({ open: true, mode: 'edit', id: h.id, name: h.name ?? '', date: h.date ?? '', is_federal: h.is_federal ?? false })} className="p-1 text-muted-foreground hover:text-foreground"><Edit className="w-3 h-3" /></button>
              <button onClick={() => deleteMutation.mutate(h.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialog.open} onOpenChange={o => setDialog(p => ({ ...p, open: o }))}>
        <DialogContent><DialogHeader><DialogTitle>{dialog.mode === 'create' ? 'Add Holiday' : 'Edit Holiday'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={dialog.name} onChange={e => setDialog(p => ({ ...p, name: e.target.value }))} placeholder="Holiday name" className="bg-secondary border-border" />
            <Input type="date" value={dialog.date} onChange={e => setDialog(p => ({ ...p, date: e.target.value }))} className="bg-secondary border-border" />
            <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={dialog.is_federal} onChange={e => setDialog(p => ({ ...p, is_federal: e.target.checked }))} />Federal Holiday</label>
          </div>
          <DialogFooter><Button onClick={() => saveMutation.mutate()} disabled={!dialog.name || !dialog.date || saveMutation.isPending} className="bg-primary text-primary-foreground">{saveMutation.isPending ? <Spinner size="sm" /> : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Ticket Templates Section ───
const TicketTemplatesSection = () => {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; mode: 'create' | 'edit'; id?: string; name: string; work_type: string; description: string }>({ open: false, mode: 'create', name: '', work_type: '', description: '' });

  const { data: templates, isLoading } = useQuery({
    queryKey: ['ticket_templates'],
    queryFn: async () => { const { data, error } = await supabase.from('ticket_templates').select('*').order('name'); if (error) throw error; return data ?? []; },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { name: dialog.name, work_type: dialog.work_type || null, description: dialog.description };
      if (dialog.mode === 'create') { const { error } = await supabase.from('ticket_templates').insert(payload); if (error) throw error; }
      else { const { error } = await supabase.from('ticket_templates').update(payload).eq('id', dialog.id!); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ticket_templates'] }); toast.success('Saved.'); setDialog({ open: false, mode: 'create', name: '', work_type: '', description: '' }); },
    onError: () => toast.error('Failed.'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('ticket_templates').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ticket_templates'] }); toast.success('Deleted.'); },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Ticket Templates</h3>
        <Button size="sm" onClick={() => setDialog({ open: true, mode: 'create', name: '', work_type: '', description: '' })} className="bg-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1" />Add</Button>
      </div>
      <div className="flex flex-col gap-2">
        {templates?.map(t => (
          <div key={t.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
            <div><span className="font-medium text-foreground">{t.name}</span>{t.work_type && <Badge variant="secondary" className="ml-2 text-xs">{t.work_type}</Badge>}</div>
            <div className="flex gap-1">
              <button onClick={() => setDialog({ open: true, mode: 'edit', id: t.id, name: t.name, work_type: t.work_type ?? '', description: t.description ?? '' })} className="p-1 text-muted-foreground hover:text-foreground"><Edit className="w-3 h-3" /></button>
              <button onClick={() => deleteMutation.mutate(t.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
        {templates?.length === 0 && <p className="text-sm text-muted-foreground">No templates yet.</p>}
      </div>

      <Dialog open={dialog.open} onOpenChange={o => setDialog(p => ({ ...p, open: o }))}>
        <DialogContent><DialogHeader><DialogTitle>{dialog.mode === 'create' ? 'Add Template' : 'Edit Template'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={dialog.name} onChange={e => setDialog(p => ({ ...p, name: e.target.value }))} placeholder="Template name" className="bg-secondary border-border" />
            <Select value={dialog.work_type} onValueChange={v => setDialog(p => ({ ...p, work_type: v }))}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Work type (optional)" /></SelectTrigger>
              <SelectContent><SelectItem value="make_ready">Make-Ready</SelectItem><SelectItem value="emergency">Emergency</SelectItem><SelectItem value="repair">Repair</SelectItem><SelectItem value="capex">CapEx</SelectItem></SelectContent>
            </Select>
            <Textarea value={dialog.description} onChange={e => setDialog(p => ({ ...p, description: e.target.value }))} placeholder="Description" rows={4} className="bg-secondary border-border" />
          </div>
          <DialogFooter><Button onClick={() => saveMutation.mutate()} disabled={!dialog.name || saveMutation.isPending} className="bg-primary text-primary-foreground">{saveMutation.isPending ? <Spinner size="sm" /> : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Company Profile Section ───
const CompanyProfileSection = () => {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['company_profile'],
    queryFn: async () => { const { data, error } = await supabase.from('company_profile').select('*').limit(1).maybeSingle(); if (error) throw error; return data; },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form) return;
      if (profile) {
        const { error } = await supabase.from('company_profile').update(form).eq('id', profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('company_profile').insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company_profile'] }); toast.success('Saved.'); },
    onError: () => toast.error('Failed.'),
  });

  const currentForm = form ?? profile ?? { company_name: '', contact_email: '', phone: '', physical_address: '', city: '' };

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;

  return (
    <div>
      <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">Company Profile</h3>
      <div className="space-y-3 max-w-lg">
        {['company_name', 'contact_email', 'phone', 'physical_address', 'city'].map(field => (
          <div key={field}>
            <label className="text-xs text-muted-foreground capitalize">{field.replace(/_/g, ' ')}</label>
            <Input value={currentForm[field] ?? ''} onChange={e => setForm({ ...currentForm, [field]: e.target.value })} className="bg-secondary border-border" />
          </div>
        ))}
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-primary text-primary-foreground">{saveMutation.isPending ? <Spinner size="sm" /> : 'Save'}</Button>
      </div>
    </div>
  );
};

// ─── Timezone Section ───
const TimezoneSection = () => {
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['company_profile'],
    queryFn: async () => { const { data, error } = await supabase.from('company_profile').select('*').limit(1).maybeSingle(); if (error) throw error; return data; },
  });

  const saveMutation = useMutation({
    mutationFn: async (tz: string) => {
      if (profile) {
        const { error } = await supabase.from('company_profile').update({ timezone: tz }).eq('id', profile.id);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company_profile'] }); toast.success('Timezone updated.'); },
    onError: () => toast.error('Failed.'),
  });

  const timezones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'Pacific/Honolulu'];

  return (
    <div>
      <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">Timezone</h3>
      <p className="text-xs text-muted-foreground mb-3">Applies to all timestamps and reports system-wide.</p>
      <Select value={profile?.timezone ?? 'America/New_York'} onValueChange={v => saveMutation.mutate(v)}>
        <SelectTrigger className="bg-secondary border-border max-w-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{timezones.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
};

// ─── Export/Import Section ───
const ExportImportSection = () => {
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    const tables = ['clients', 'properties', 'zones', 'tickets', 'inspections', 'technicians_vendors', 'holidays'] as const;
    const csvParts: string[] = [];
    for (const table of tables) {
      const { data } = await supabase.from(table).select('*');
      if (data && data.length > 0) {
        const headers = Object.keys(data[0]);
        const rows = data.map(row => headers.map(h => JSON.stringify((row as any)[h] ?? '')).join(','));
        csvParts.push(`--- ${table} ---\n${headers.join(',')}\n${rows.join('\n')}`);
      }
    }
    const blob = new Blob([csvParts.join('\n\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `fiveserv_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Export downloaded.');
  };

  const handleImport = async (type: 'pms' | 'properties', file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.trim().split('\n');
      if (lines.length < 2) throw new Error('File must have a header and at least one row.');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      if (type === 'pms') {
        const required = ['company_name', 'contact_name', 'email', 'phone'];
        if (!required.every(r => headers.includes(r))) throw new Error(`CSV must have columns: ${required.join(', ')}`);
        const rows = lines.slice(1).map(line => {
          const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          return { company_name: vals[headers.indexOf('company_name')], contact_name: vals[headers.indexOf('contact_name')], email: vals[headers.indexOf('email')], phone: vals[headers.indexOf('phone')], type: 'pm', status: 'active' };
        });
        const { error } = await supabase.from('clients').insert(rows);
        if (error) throw error;
        toast.success(`Imported ${rows.length} PMs.`);
      } else {
        const required = ['property_name', 'address', 'pm_email', 'zone', 'city'];
        if (!required.every(r => headers.includes(r))) throw new Error(`CSV must have columns: ${required.join(', ')}`);
        const rows = lines.slice(1).map(line => {
          const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          return { name: vals[headers.indexOf('property_name')], address: `${vals[headers.indexOf('address')]}, ${vals[headers.indexOf('city')]}` };
        });
        const { error } = await supabase.from('properties').insert(rows);
        if (error) throw error;
        toast.success(`Imported ${rows.length} properties.`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">Export & Import</h3>
      <div className="space-y-4">
        <div>
          <Button onClick={handleExport} variant="outline" className="border-primary text-primary"><Download className="w-4 h-4 mr-2" />Export Database (CSV)</Button>
          <p className="text-xs text-muted-foreground mt-1">Full export including photo/video URL references.</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-foreground font-medium">Import PMs (CSV)</p>
          <p className="text-xs text-muted-foreground">4 columns: company_name, contact_name, email, phone — all or nothing</p>
          <input type="file" accept=".csv" disabled={importing} onChange={e => { if (e.target.files?.[0]) handleImport('pms', e.target.files[0]); }} className="text-sm text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <p className="text-sm text-foreground font-medium">Import Properties (CSV)</p>
          <p className="text-xs text-muted-foreground">5 columns: property_name, address, pm_email, zone, city — all or nothing</p>
          <input type="file" accept=".csv" disabled={importing} onChange={e => { if (e.target.files?.[0]) handleImport('properties', e.target.files[0]); }} className="text-sm text-muted-foreground" />
        </div>
      </div>
    </div>
  );
};

// ─── Main Settings Page ───
const settingsSections = [
  { key: 'specialties', label: 'Specialties', icon: Tag },
  { key: 'work_types', label: 'Work Types', icon: Wrench },
  { key: 'email_templates', label: 'Email Templates', icon: FileText },
  { key: 'inspection_items', label: 'Inspection Items', icon: ClipboardList },
  { key: 'zones', label: 'Zones', icon: MapPin },
  { key: 'master_pin', label: 'Master PIN', icon: Key },
  { key: 'holidays', label: 'Holidays', icon: Calendar },
  { key: 'ticket_templates', label: 'Ticket Templates', icon: FileText },
  { key: 'company_profile', label: 'Company Profile', icon: Building2 },
  { key: 'export_import', label: 'Export & Import', icon: Download },
  { key: 'timezone', label: 'Timezone', icon: Globe },
];

const SettingsPage = () => {
  const [activeSection, setActiveSection] = useState('specialties');

  const renderSection = () => {
    switch (activeSection) {
      case 'specialties': return <SpecialtiesSection />;
      case 'work_types': return <WorkTypesSection />;
      case 'email_templates': return <EmailTemplatesSection />;
      case 'inspection_items': return <InspectionItemsSection />;
      case 'zones': return <ZonesSection />;
      case 'master_pin': return <MasterPinSection />;
      case 'holidays': return <HolidaysSection />;
      case 'ticket_templates': return <TicketTemplatesSection />;
      case 'company_profile': return <CompanyProfileSection />;
      case 'export_import': return <ExportImportSection />;
      case 'timezone': return <TimezoneSection />;
      default: return null;
    }
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold text-foreground mb-6">Settings</h1>
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <div className="hidden md:block w-56 flex-shrink-0">
          <div className="flex flex-col gap-1">
            {settingsSections.map(s => (
              <button key={s.key} onClick={() => setActiveSection(s.key)}
                className={`flex items-center gap-2 px-3 py-3 rounded-md text-sm text-left transition-colors min-h-[44px] ${activeSection === s.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}>
                <s.icon className="w-4 h-4" />{s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden w-full">
          <Select value={activeSection} onValueChange={setActiveSection}>
            <SelectTrigger className="bg-secondary border-border mb-4 min-h-[44px]"><SelectValue /></SelectTrigger>
            <SelectContent>{settingsSections.map(s => <SelectItem key={s.key} value={s.key} className="min-h-[44px]">{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {renderSection()}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
