import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Spinner from '@/components/ui/Spinner';
import { toast } from 'sonner';
import FormShell from '@/components/form/FormShell';
import FormSection from '@/components/form/FormSection';
import FormField from '@/components/form/FormField';

const ClientForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [form, setForm] = useState({ company_name: '', contact_name: '', email: '', phone: '', type: 'pm', address: '', referred_by: '', lead_source: '' });
  const [emailError, setEmailError] = useState('');

  const { data: existing, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        company_name: existing.company_name ?? '',
        contact_name: existing.contact_name ?? '',
        email: existing.email ?? '',
        phone: existing.phone ?? '',
        type: existing.type ?? 'pm',
        address: (existing as any).address ?? '',
        referred_by: (existing as any).referred_by ?? '',
        lead_source: (existing as any).lead_source ?? '',
      });
    }
  }, [existing]);

  useEffect(() => {
    if (!form.email) { setEmailError(''); return; }
    const t = setTimeout(async () => {
      let query = supabase.from('clients').select('id').eq('email', form.email.toLowerCase()).eq('is_deleted', false);
      if (isEdit) query = query.neq('id', id!);
      const { data } = await query.limit(1);
      setEmailError(data && data.length > 0 ? 'This email is already registered' : '');
    }, 400);
    return () => clearTimeout(t);
  }, [form.email, id, isEdit]);

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        email: form.email.toLowerCase(),
        referred_by: form.referred_by.trim() || null,
        lead_source: form.lead_source || null,
      };
      if (isEdit) {
        const { error } = await supabase.from('clients').update(payload).eq('id', id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clients').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success(isEdit ? 'Client updated.' : 'Client created.');
      navigate('/clients');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to save client.'),
  });

  const canSubmit = form.company_name && form.email && !emailError && !mutation.isPending;

  if (isEdit && isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <FormShell
      title={isEdit ? 'Edit Client' : 'New Client'}
      subtitle={isEdit ? undefined : 'Add a property manager or residential owner.'}
      footer={
        <Button
          onClick={() => mutation.mutate()}
          disabled={!canSubmit}
          className="w-full sm:ml-auto sm:w-auto sm:min-w-[180px]"
        >
          {mutation.isPending ? <Spinner size="sm" /> : isEdit ? 'Update Client' : 'Create Client'}
        </Button>
      }
    >
      <FormSection title="Contact">
        <FormField label="Company name" required>
          <Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="e.g. Acme Property Group" />
        </FormField>
        <FormField label="Contact name">
          <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="Primary contact" />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Email" required error={emailError || undefined}>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@company.com" />
          </FormField>
          <FormField label="Phone">
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))} placeholder="(555) 123-4567" />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Classification">
        <FormField label="Type" required>
          <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pm">Property Manager</SelectItem>
              <SelectItem value="residential">Residential Owner</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        {form.type === 'residential' && (
          <FormField label="Service address" hint="Home or service address for this residential client.">
            <Input
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="e.g. 123 Main St, Springfield"
            />
          </FormField>
        )}
      </FormSection>

      <FormSection title="Attribution" description="Optional — helps track where new business comes from.">
        <FormField label="Referred by">
          <Input
            value={form.referred_by}
            onChange={e => setForm(f => ({ ...f, referred_by: e.target.value }))}
            placeholder="Name of person or client who referred them"
          />
        </FormField>
        <FormField label="Lead source">
          <Select value={form.lead_source || 'none'} onValueChange={v => setForm(f => ({ ...f, lead_source: v === 'none' ? '' : v }))}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              <SelectItem value="referral">Referral</SelectItem>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="social">Social</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </FormSection>
    </FormShell>
  );
};

export default ClientForm;
