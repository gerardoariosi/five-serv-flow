import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

const SPECIALTIES_CATALOG = [
  'Plumbing', 'Electrical', 'HVAC', 'Painting', 'Carpentry',
  'Flooring', 'Appliance Repair', 'Landscaping', 'General Maintenance',
  'Drywall', 'Roofing', 'Locksmith', 'Cleaning', 'Pest Control',
];

const VendorDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    phone: '',
    email: '',
    specialties: [] as string[],
    license_number: '',
    insurance_info: '',
    notes: '',
    status: 'active',
  });
  const [saving, setSaving] = useState(false);

  const { data: vendor } = useQuery({
    queryKey: ['vendor', id],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase.from('technicians_vendors').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (vendor) {
      setForm({
        company_name: vendor.company_name || '',
        contact_name: vendor.contact_name || '',
        phone: vendor.phone || '',
        email: vendor.email || '',
        specialties: vendor.specialties || [],
        license_number: vendor.license_number || '',
        insurance_info: vendor.insurance_info || '',
        notes: vendor.notes || '',
        status: vendor.status || 'active',
      });
    }
  }, [vendor]);

  const toggleSpecialty = (s: string) => {
    setForm((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(s) ? prev.specialties.filter((x) => x !== s) : [...prev.specialties, s],
    }));
  };

  const handleSave = async () => {
    if (!form.company_name.trim()) { toast.error('Company name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        company_name: form.company_name,
        contact_name: form.contact_name,
        phone: form.phone,
        email: form.email || null,
        specialties: form.specialties,
        license_number: form.license_number || null,
        insurance_info: form.insurance_info || null,
        notes: form.notes || null,
        status: form.status,
        type: 'vendor' as const,
      };
      if (isNew) {
        const { error } = await supabase.from('technicians_vendors').insert(payload);
        if (error) throw error;
        toast.success('Vendor created');
      } else {
        const { error } = await supabase.from('technicians_vendors').update(payload).eq('id', id!);
        if (error) throw error;
        toast.success('Vendor updated');
      }
      navigate('/team/technicians');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/team/technicians')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">{isNew ? 'New Vendor' : 'Edit Vendor'}</h1>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Company Name *</Label>
          <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
        </div>
        <div>
          <Label>Contact Name</Label>
          <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <Label>Email (optional)</Label>
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <Label>License #</Label>
          <Input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} />
        </div>
        <div>
          <Label>Insurance Info</Label>
          <Input value={form.insurance_info} onChange={(e) => setForm({ ...form, insurance_info: e.target.value })} />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
        </div>

        <div>
          <Label>Status</Label>
          <div className="flex items-center gap-2 mt-1">
            <Switch checked={form.status === 'active'} onCheckedChange={(v) => setForm({ ...form, status: v ? 'active' : 'archived' })} />
            <span className="text-sm text-muted-foreground">{form.status === 'active' ? 'Active' : 'Archived'}</span>
          </div>
        </div>

        <div>
          <Label>Specialties</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {SPECIALTIES_CATALOG.map((s) => (
              <Badge
                key={s}
                variant={form.specialties.includes(s) ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => toggleSpecialty(s)}
              >
                {s}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Vendor'}
      </Button>
    </div>
  );
};

export default VendorDetail;
