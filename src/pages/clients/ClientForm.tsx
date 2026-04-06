import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Spinner from '@/components/ui/Spinner';
import { toast } from 'sonner';

const ClientForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [form, setForm] = useState({ company_name: '', contact_name: '', email: '', phone: '', type: 'pm' });
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
      });
    }
  }, [existing]);

  // Real-time duplicate email check
  useEffect(() => {
    if (!form.email) { setEmailError(''); return; }
    const t = setTimeout(async () => {
      let query = supabase.from('clients').select('id').eq('email', form.email.toLowerCase());
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
      const payload = { ...form, email: form.email.toLowerCase() };
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
    onError: () => toast.error('Failed to save client.'),
  });

  const canSubmit = form.company_name && form.email && !emailError && !mutation.isPending;

  if (isEdit && isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="p-4 max-w-lg mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h1 className="text-xl font-bold text-foreground mb-6">{isEdit ? 'Edit Client' : 'New Client'}</h1>

      <div className="flex flex-col gap-4">
        <div>
          <Label>Company Name *</Label>
          <Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} className="bg-secondary border-border" />
        </div>
        <div>
          <Label>Contact Name</Label>
          <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} className="bg-secondary border-border" />
        </div>
        <div>
          <Label>Email *</Label>
          <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="bg-secondary border-border" />
          {emailError && <p className="text-xs text-destructive mt-1">{emailError}</p>}
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))} placeholder="(555) 123-4567" className="bg-secondary border-border" />
        </div>
        <div>
          <Label>Type *</Label>
          <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
            <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pm">Property Manager</SelectItem>
              <SelectItem value="residential">Residential Owner</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => mutation.mutate()} disabled={!canSubmit} className="bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
          {mutation.isPending ? <Spinner size="sm" /> : isEdit ? 'Update Client' : 'Create Client'}
        </Button>
      </div>
    </div>
  );
};

export default ClientForm;
