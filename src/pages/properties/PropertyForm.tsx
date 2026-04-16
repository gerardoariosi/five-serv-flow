import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Upload } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import Spinner from '@/components/ui/Spinner';
import { toast } from 'sonner';

const PropertyForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ address: '', zone_id: '', current_pm_id: '' });
  const [addressError, setAddressError] = useState('');
  const [newZoneDialog, setNewZoneDialog] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [importing, setImporting] = useState(false);

  const { data: existing, isLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('properties').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  const { data: zones } = useQuery({
    queryKey: ['zones-dropdown'],
    queryFn: async () => {
      const { data } = await supabase.from('zones').select('id, name').eq('status', 'active').order('name');
      return data ?? [];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ['clients-dropdown'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, company_name').eq('status', 'active').order('company_name');
      return data ?? [];
    },
  });

  useEffect(() => {
    if (existing) {
      setForm({ address: existing.address ?? existing.name ?? '', zone_id: existing.zone_id ?? '', current_pm_id: existing.current_pm_id ?? '' });
    } else {
      const clientId = searchParams.get('client_id');
      if (clientId) setForm(f => ({ ...f, current_pm_id: clientId }));
    }
  }, [existing, searchParams]);

  // Address uniqueness check
  useEffect(() => {
    if (!form.address) { setAddressError(''); return; }
    const t = setTimeout(async () => {
      let query = supabase.from('properties').select('id').eq('address', form.address);
      if (isEdit) query = query.neq('id', id!);
      const { data } = await query.limit(1);
      setAddressError(data && data.length > 0 ? 'This address is already registered' : '');
    }, 400);
    return () => clearTimeout(t);
  }, [form.address, id, isEdit]);

  const mutation = useMutation({
    mutationFn: async () => {
      // Address is the property identifier; mirror it to `name` for backward compatibility
      const payload = { ...form, name: form.address };
      if (isEdit && existing?.current_pm_id && form.current_pm_id !== existing.current_pm_id) {
        // PM reassignment — update property + reassign active tickets
        const { error } = await supabase.from('properties').update({
          ...payload,
          previous_pm_id: existing.current_pm_id,
          pm_changed_at: new Date().toISOString(),
        }).eq('id', id!);
        if (error) throw error;

        await supabase.from('tickets').update({ client_id: form.current_pm_id }).eq('property_id', id!).not('status', 'in', '("closed","cancelled")');
      } else if (isEdit) {
        const { error } = await supabase.from('properties').update(payload).eq('id', id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('properties').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success(isEdit ? 'Property updated.' : 'Property created.');
      navigate('/properties');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to save property.'),
  });

  const createZoneMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('zones').insert({ name: newZoneName }).select('id').single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['zones-dropdown'] });
      setForm(f => ({ ...f, zone_id: data.id }));
      setNewZoneDialog(false);
      setNewZoneName('');
      toast.success('Zone created.');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to create zone.'),
  });

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      const addrIdx = headers.indexOf('address');
      const pmEmailIdx = headers.indexOf('pm_email');
      const zoneIdx = headers.indexOf('zone');

      if (addrIdx === -1) throw new Error('Missing required column: address');

      const rows = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim());
        return { address: cols[addrIdx], pm_email: cols[pmEmailIdx] ?? '', zone: cols[zoneIdx] ?? '' };
      });

      // Resolve zones
      const uniqueZones = [...new Set(rows.map(r => r.zone).filter(Boolean))];
      const { data: existingZones } = await supabase.from('zones').select('id, name');
      const zoneMap: Record<string, string> = {};
      existingZones?.forEach(z => { zoneMap[z.name!.toLowerCase()] = z.id; });

      for (const zn of uniqueZones) {
        if (!zoneMap[zn.toLowerCase()]) {
          const { data } = await supabase.from('zones').insert({ name: zn }).select('id').single();
          if (data) zoneMap[zn.toLowerCase()] = data.id;
        }
      }

      // Resolve PMs
      const uniqueEmails = [...new Set(rows.map(r => r.pm_email).filter(Boolean))];
      const { data: existingClients } = await supabase.from('clients').select('id, email');
      const pmMap: Record<string, string> = {};
      existingClients?.forEach(c => { if (c.email) pmMap[c.email.toLowerCase()] = c.id; });

      // Check for duplicate addresses
      const addresses = rows.map(r => r.address);
      const { data: existingProps } = await supabase.from('properties').select('address').in('address', addresses);
      if (existingProps && existingProps.length > 0) {
        throw new Error(`Duplicate addresses found: ${existingProps.map(p => p.address).join(', ')}`);
      }

      // Insert all — address is the identifier; mirror to name for backward compatibility
      const inserts = rows.map(r => ({
        name: r.address,
        address: r.address,
        zone_id: r.zone ? zoneMap[r.zone.toLowerCase()] || null : null,
        current_pm_id: r.pm_email ? pmMap[r.pm_email.toLowerCase()] || null : null,
      }));

      const { error } = await supabase.from('properties').insert(inserts);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success(`${inserts.length} properties imported.`);
    } catch (err: any) {
      toast.error(err.message || 'Import failed.');
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const canSubmit = form.address && !addressError && !mutation.isPending;

  if (isEdit && isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="p-4 max-w-lg mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-foreground">{isEdit ? 'Edit Property' : 'New Property'}</h1>
        {!isEdit && (
          <>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
              <Upload className="w-4 h-4 mr-1" /> {importing ? 'Importing...' : 'CSV Import'}
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
          </>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <Label>Address *</Label>
          <Input
            value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            placeholder="e.g. 123 Main St, Springfield"
            className="bg-secondary border-border"
          />
          {addressError && <p className="text-xs text-destructive mt-1">{addressError}</p>}
          <p className="text-xs text-muted-foreground mt-1">The address identifies the property everywhere in the app.</p>
        </div>
        <div>
          <Label>Zone</Label>
          <div className="flex gap-2">
            <Select value={form.zone_id} onValueChange={v => setForm(f => ({ ...f, zone_id: v }))}>
              <SelectTrigger className="bg-secondary border-border flex-1"><SelectValue placeholder="Select zone" /></SelectTrigger>
              <SelectContent>
                {zones?.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => setNewZoneDialog(true)} title="Create new zone">+</Button>
          </div>
        </div>
        <div>
          <Label>Property Manager</Label>
          <Select value={form.current_pm_id} onValueChange={v => setForm(f => ({ ...f, current_pm_id: v }))}>
            <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select PM" /></SelectTrigger>
            <SelectContent>
              {clients?.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => mutation.mutate()} disabled={!canSubmit} className="bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
          {mutation.isPending ? <Spinner size="sm" /> : isEdit ? 'Update Property' : 'Create Property'}
        </Button>
      </div>

      {/* New Zone Dialog */}
      <Dialog open={newZoneDialog} onOpenChange={setNewZoneDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Zone</DialogTitle></DialogHeader>
          <Input value={newZoneName} onChange={e => setNewZoneName(e.target.value)} placeholder="Zone name" className="bg-secondary border-border" />
          <DialogFooter>
            <Button onClick={() => createZoneMutation.mutate()} disabled={!newZoneName || createZoneMutation.isPending} className="bg-primary text-primary-foreground">
              {createZoneMutation.isPending ? <Spinner size="sm" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PropertyForm;
