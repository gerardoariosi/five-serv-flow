import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save, Camera } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import { toast } from 'sonner';

const SPECIALTIES_CATALOG = [
  'Plumbing', 'Electrical', 'HVAC', 'Painting', 'Carpentry',
  'Flooring', 'Appliance Repair', 'Landscaping', 'General Maintenance',
  'Drywall', 'Roofing', 'Locksmith', 'Cleaning', 'Pest Control',
];

const roleOptions = ['admin', 'supervisor', 'technician', 'accounting'] as const;

const TeamUserForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    roles: [] as string[],
    specialties: [] as string[],
    status: 'active',
  });
  const [saving, setSaving] = useState(false);

  // Load existing user data
  const { data: existingUser, isLoading } = useQuery({
    queryKey: ['team-user', id],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase.from('users').select('*').eq('id', id!).single();
      if (error) throw error;

      // Get roles from user_roles table
      const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', id!);
      const userRoles = rolesData?.map(r => r.role) ?? [];

      // Get technician record if exists
      const { data: techRecord } = await supabase.from('technicians_vendors')
        .select('*').eq('user_id', id!).eq('type', 'technician').maybeSingle();

      return { ...data, userRoles, techRecord };
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (existingUser) {
      setForm({
        full_name: existingUser.full_name ?? '',
        email: existingUser.email ?? '',
        phone: existingUser.phone ?? '',
        roles: existingUser.userRoles ?? (existingUser.roles as string[] ?? []),
        specialties: existingUser.techRecord?.specialties ?? [],
        status: existingUser.is_locked ? 'archived' : 'active',
      });
    }
  }, [existingUser]);

  const toggleRole = (role: string) => {
    setForm(prev => ({
      ...prev,
      roles: prev.roles.includes(role) ? prev.roles.filter(r => r !== role) : [...prev.roles, role],
    }));
  };

  const toggleSpecialty = (s: string) => {
    setForm(prev => ({
      ...prev,
      specialties: prev.specialties.includes(s) ? prev.specialties.filter(x => x !== s) : [...prev.specialties, s],
    }));
  };

  const isTechnician = form.roles.includes('technician');

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast.error('Name is required'); return; }
    if (!form.email.trim()) { toast.error('Email is required'); return; }
    if (form.roles.length === 0) { toast.error('At least one role is required'); return; }

    setSaving(true);
    try {
      if (isNew) {
        // Create user record
        const { data: newUser, error } = await supabase.from('users').insert({
          full_name: form.full_name,
          email: form.email.toLowerCase(),
          phone: form.phone,
          roles: form.roles,
        }).select().single();
        if (error) throw error;

        // Insert roles into user_roles
        const roleInserts = form.roles.map(role => ({ user_id: newUser.id, role: role as any }));
        await supabase.from('user_roles').insert(roleInserts);

        // If technician, create technicians_vendors record
        if (isTechnician) {
          await supabase.from('technicians_vendors').insert({
            contact_name: form.full_name,
            email: form.email.toLowerCase(),
            phone: form.phone,
            specialties: form.specialties,
            type: 'technician',
            user_id: newUser.id,
          });
        }

        toast.success('User created');
      } else {
        // Update user
        const { error } = await supabase.from('users').update({
          full_name: form.full_name,
          phone: form.phone,
          roles: form.roles,
          is_locked: form.status === 'archived',
        }).eq('id', id!);
        if (error) throw error;

        // Sync user_roles
        await supabase.from('user_roles').delete().eq('user_id', id!);
        const roleInserts = form.roles.map(role => ({ user_id: id!, role: role as any }));
        await supabase.from('user_roles').insert(roleInserts);

        // Sync technicians_vendors record
        if (isTechnician) {
          const { data: existing } = await supabase.from('technicians_vendors')
            .select('id').eq('user_id', id!).eq('type', 'technician').maybeSingle();
          if (existing) {
            await supabase.from('technicians_vendors').update({
              contact_name: form.full_name,
              phone: form.phone,
              specialties: form.specialties,
              status: form.status,
            }).eq('id', existing.id);
          } else {
            await supabase.from('technicians_vendors').insert({
              contact_name: form.full_name,
              email: form.email.toLowerCase(),
              phone: form.phone,
              specialties: form.specialties,
              type: 'technician',
              user_id: id!,
            });
          }
        }

        toast.success('User updated');
      }

      queryClient.invalidateQueries({ queryKey: ['team-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      navigate('/team/technicians');
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!isNew && isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  return (
    <div className="p-4 max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/team/technicians')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">{isNew ? 'New User' : 'Edit User'}</h1>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Full Name *</Label>
          <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="bg-secondary border-border" />
        </div>
        <div>
          <Label>Email *</Label>
          <Input
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            readOnly={!isNew}
            className={`bg-secondary border-border ${!isNew ? 'opacity-60' : ''}`}
          />
          {!isNew && <p className="text-[10px] text-muted-foreground mt-1">Email cannot be changed after creation</p>}
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-secondary border-border" />
        </div>

        {/* Roles */}
        <div>
          <Label className="font-medium">Roles *</Label>
          <p className="text-xs text-muted-foreground mb-2">Select at least one role. This determines what the user can access.</p>
          <div className="grid grid-cols-2 gap-3 mt-1">
            {roleOptions.map(role => (
              <div key={role} className="flex items-center gap-2 p-2 rounded-md border border-border bg-card">
                <Checkbox
                  id={`role-${role}`}
                  checked={form.roles.includes(role)}
                  onCheckedChange={() => toggleRole(role)}
                />
                <Label htmlFor={`role-${role}`} className="text-sm capitalize cursor-pointer flex-1">{role}</Label>
              </div>
            ))}
          </div>
          {form.roles.length === 0 && (
            <p className="text-xs text-destructive mt-1">At least one role is required</p>
          )}
        </div>

        {/* Status (edit only) */}
        {!isNew && (
          <div>
            <Label>Status</Label>
            <div className="flex items-center gap-2 mt-1">
              <Switch checked={form.status === 'active'} onCheckedChange={v => setForm({ ...form, status: v ? 'active' : 'archived' })} />
              <span className="text-sm text-muted-foreground">{form.status === 'active' ? 'Active' : 'Archived'}</span>
            </div>
          </div>
        )}

        {/* Technician-specific fields */}
        {isTechnician && (
          <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
            <h3 className="text-sm font-semibold text-foreground">Technician Settings</h3>
            <div>
              <Label>Specialties</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {SPECIALTIES_CATALOG.map(s => (
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
        )}
      </div>

      <Button onClick={handleSave} disabled={saving || form.roles.length === 0} className="w-full bg-primary text-primary-foreground">
        <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : isNew ? 'Create User' : 'Save User'}
      </Button>
    </div>
  );
};

export default TeamUserForm;