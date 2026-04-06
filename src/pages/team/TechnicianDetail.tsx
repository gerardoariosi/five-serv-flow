import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Camera, Save } from 'lucide-react';
import { toast } from 'sonner';

const SPECIALTIES_CATALOG = [
  'Plumbing', 'Electrical', 'HVAC', 'Painting', 'Carpentry',
  'Flooring', 'Appliance Repair', 'Landscaping', 'General Maintenance',
  'Drywall', 'Roofing', 'Locksmith', 'Cleaning', 'Pest Control',
];

const TechnicianDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [form, setForm] = useState({
    contact_name: '',
    phone: '',
    email: '',
    specialties: [] as string[],
    status: 'active',
    photo_url: '',
  });
  const [saving, setSaving] = useState(false);

  const { data: tech } = useQuery({
    queryKey: ['technician', id],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase.from('technicians_vendors').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  const { data: ticketHistory = [] } = useQuery({
    queryKey: ['tech-ticket-history', id],
    queryFn: async () => {
      if (isNew || !tech?.user_id) return [];
      const { data, error } = await supabase
        .from('tickets')
        .select('id, fs_number, property_id, work_type, appointment_time, status')
        .eq('technician_id', tech.user_id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !isNew && !!tech?.user_id,
  });

  const { data: weekTickets = 0 } = useQuery({
    queryKey: ['tech-week-workload', id],
    queryFn: async () => {
      if (isNew || !tech?.user_id) return 0;
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      const { count, error } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('technician_id', tech.user_id)
        .gte('appointment_time', startOfWeek.toISOString())
        .lt('appointment_time', endOfWeek.toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled: !isNew && !!tech?.user_id,
  });

  useEffect(() => {
    if (tech) {
      setForm({
        contact_name: tech.contact_name || '',
        phone: tech.phone || '',
        email: tech.email || '',
        specialties: tech.specialties || [],
        status: tech.status || 'active',
        photo_url: '',
      });
    }
  }, [tech]);

  const toggleSpecialty = (s: string) => {
    setForm((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(s)
        ? prev.specialties.filter((x) => x !== s)
        : [...prev.specialties, s],
    }));
  };

  const handleSave = async () => {
    if (!form.contact_name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        contact_name: form.contact_name,
        phone: form.phone,
        email: form.email,
        specialties: form.specialties,
        status: form.status,
        type: 'technician' as const,
      };
      if (isNew) {
        const { error } = await supabase.from('technicians_vendors').insert(payload);
        if (error) throw error;
        toast.success('Technician created');
      } else {
        const { error } = await supabase.from('technicians_vendors').update(payload).eq('id', id!);
        if (error) throw error;
        toast.success('Technician updated');
      }
      navigate('/team/technicians');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return; }
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      if (img.width < 200 || img.height < 200) {
        toast.error('Minimum 200×200px');
        return;
      }
    };
    toast.info('Photo upload: connect to storage for full support');
  };

  return (
    <div className="p-4 max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/team/technicians')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">{isNew ? 'New Technician' : 'Edit Technician'}</h1>
      </div>

      {/* Photo */}
      <div className="flex justify-center">
        <label className="relative w-24 h-24 rounded-full bg-secondary border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
          <Camera className="w-6 h-6 text-muted-foreground" />
          <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          <span className="absolute -bottom-5 text-[10px] text-muted-foreground">Min 200×200</span>
        </label>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Full Name *</Label>
          <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} readOnly={!isNew} className={!isNew ? 'opacity-60' : ''} />
          {!isNew && <p className="text-[10px] text-muted-foreground mt-1">Email managed from User Management</p>}
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

      {/* Workload */}
      {!isNew && tech?.user_id && (
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-sm font-semibold text-foreground">Workload This Week</p>
          <p className="text-2xl font-bold text-primary">{weekTickets}</p>
          <p className="text-xs text-muted-foreground">assigned tickets</p>
        </div>
      )}

      {/* Ticket History */}
      {!isNew && ticketHistory.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Ticket History</p>
          {ticketHistory.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between p-2 rounded border border-border bg-card cursor-pointer hover:border-primary/40 text-sm"
              onClick={() => navigate(`/tickets/${t.id}`)}
            >
              <div>
                <span className="font-medium text-foreground">{t.fs_number}</span>
                <span className="text-muted-foreground ml-2">{t.work_type}</span>
              </div>
              <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
            </div>
          ))}
        </div>
      )}

      <Button onClick={handleSave} disabled={saving} className="w-full">
        <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Technician'}
      </Button>
    </div>
  );
};

export default TechnicianDetail;
