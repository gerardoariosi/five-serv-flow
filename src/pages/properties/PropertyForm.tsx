import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import Spinner from '@/components/ui/Spinner';
import { toast } from 'sonner';
import { US_STATES, formatAddress } from '@/lib/propertyAddress';
import FormShell from '@/components/form/FormShell';
import FormSection from '@/components/form/FormSection';
import FormField from '@/components/form/FormField';

const PropertyForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    street_address: '',
    city: '',
    state: '',
    zip_code: '',
    zone_id: '',
    current_pm_id: '',
  });
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
      setForm({
        street_address: (existing as any).street_address ?? existing.address ?? existing.name ?? '',
        city: (existing as any).city ?? '',
        state: (existing as any).state ?? '',
        zip_code: (existing as any).zip_code ?? '',
        zone_id: existing.zone_id ?? '',
        current_pm_id: existing.current_pm_id ?? '',
      });
    } else {
      const clientId = searchParams.get('client_id');
      if (clientId) setForm(f => ({ ...f, current_pm_id: clientId }));
    }
  }, [existing, searchParams]);

  useEffect(() => {
    if (!form.street_address) { setAddressError(''); return; }
    const t = setTimeout(async () => {
      let query = supabase
        .from('properties')
        .select('id')
        .eq('is_deleted', false)
        .ilike('street_address', form.street_address);
      if (form.zip_code) query = query.eq('zip_code', form.zip_code);
      if (isEdit) query = query.neq('id', id!);
      const { data } = await query.limit(1);
      setAddressError(data && data.length > 0 ? 'This address is already registered' : '');
    }, 400);
    return () => clearTimeout(t);
  }, [form.street_address, form.zip_code, id, isEdit]);

  const mutation = useMutation({
    mutationFn: async () => {
      const fullAddress = formatAddress(form as any);
      const payload: any = {
        street_address: form.street_address,
        city: form.city || null,
        state: form.state || null,
        zip_code: form.zip_code || null,
        zone_id: form.zone_id || null,
        current_pm_id: form.current_pm_id || null,
        name: fullAddress || form.street_address,
        address: fullAddress,
      };
      if (isEdit && existing?.current_pm_id && form.current_pm_id !== existing.current_pm_id) {
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

      const streetIdx = headers.indexOf('street_address') >= 0 ? headers.indexOf('street_address') : headers.indexOf('address');
      const cityIdx = headers.indexOf('city');
      const stateIdx = headers.indexOf('state');
      const zipIdx = headers.indexOf('zip_code') >= 0 ? headers.indexOf('zip_code') : headers.indexOf('zip');
      const pmEmailIdx = headers.indexOf('pm_email');
      const zoneIdx = headers.indexOf('zone');

      if (streetIdx === -1) throw new Error('Missing required column: street_address (or address)');

      const rows = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim());
        return {
          street_address: cols[streetIdx] ?? '',
          city: cityIdx >= 0 ? cols[cityIdx] ?? '' : '',
          state: stateIdx >= 0 ? cols[stateIdx] ?? '' : '',
          zip_code: zipIdx >= 0 ? cols[zipIdx] ?? '' : '',
          pm_email: pmEmailIdx >= 0 ? cols[pmEmailIdx] ?? '' : '',
          zone: zoneIdx >= 0 ? cols[zoneIdx] ?? '' : '',
        };
      });

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

      const uniqueEmails = [...new Set(rows.map(r => r.pm_email).filter(Boolean))];
      const { data: existingClients } = await supabase.from('clients').select('id, email');
      const pmMap: Record<string, string> = {};
      existingClients?.forEach(c => { if (c.email) pmMap[c.email.toLowerCase()] = c.id; });

      const inserts = rows.map(r => {
        const fullAddr = formatAddress(r as any);
        return {
          name: fullAddr || r.street_address,
          address: fullAddr,
          street_address: r.street_address,
          city: r.city || null,
          state: r.state || null,
          zip_code: r.zip_code || null,
          zone_id: r.zone ? zoneMap[r.zone.toLowerCase()] || null : null,
          current_pm_id: r.pm_email ? pmMap[r.pm_email.toLowerCase()] || null : null,
        };
      });

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

  const canSubmit = form.street_address && form.city && form.state && form.zip_code && !addressError && !mutation.isPending;

  if (isEdit && isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <FormShell
      title={isEdit ? 'Edit Property' : 'New Property'}
      subtitle={isEdit ? undefined : 'Register a service address and assign a property manager.'}
      headerAction={!isEdit ? (
        <>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Upload className="w-4 h-4 mr-1.5" /> {importing ? 'Importing…' : 'CSV Import'}
          </Button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
        </>
      ) : undefined}
      footer={
        <Button
          onClick={() => mutation.mutate()}
          disabled={!canSubmit}
          className="w-full sm:ml-auto sm:w-auto sm:min-w-[180px]"
        >
          {mutation.isPending ? <Spinner size="sm" /> : isEdit ? 'Update Property' : 'Create Property'}
        </Button>
      }
    >
      <FormSection title="Address">
        <FormField label="Street address" required error={addressError || undefined}>
          <Input
            value={form.street_address}
            onChange={e => setForm(f => ({ ...f, street_address: e.target.value }))}
            placeholder="e.g. 123 Main St"
          />
        </FormField>
        <FormField label="City" required>
          <Input
            value={form.city}
            onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
            placeholder="e.g. Springfield"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="State" required>
            <Select value={form.state} onValueChange={v => setForm(f => ({ ...f, state: v }))}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent className="max-h-64">
                {US_STATES.map(s => <SelectItem key={s.code} value={s.code}>{s.code} — {s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Zip code" required>
            <Input
              value={form.zip_code}
              onChange={e => setForm(f => ({ ...f, zip_code: e.target.value.replace(/[^0-9-]/g, '').slice(0, 10) }))}
              placeholder="e.g. 12345"
              inputMode="numeric"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Assignment">
        <FormField label="Zone">
          <div className="flex gap-2">
            <Select value={form.zone_id} onValueChange={v => setForm(f => ({ ...f, zone_id: v }))}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Select zone" /></SelectTrigger>
              <SelectContent>
                {zones?.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => setNewZoneDialog(true)} title="Create new zone">+</Button>
          </div>
        </FormField>
        <FormField label="Property manager">
          <Select value={form.current_pm_id} onValueChange={v => setForm(f => ({ ...f, current_pm_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Select PM" /></SelectTrigger>
            <SelectContent>
              {clients?.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
      </FormSection>

      <Dialog open={newZoneDialog} onOpenChange={setNewZoneDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Zone</DialogTitle></DialogHeader>
          <Input value={newZoneName} onChange={e => setNewZoneName(e.target.value)} placeholder="Zone name" />
          <DialogFooter>
            <Button onClick={() => createZoneMutation.mutate()} disabled={!newZoneName || createZoneMutation.isPending}>
              {createZoneMutation.isPending ? <Spinner size="sm" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormShell>
  );
};

export default PropertyForm;
