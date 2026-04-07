import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Spinner from '@/components/ui/Spinner';
import { toast } from 'sonner';
import { Plus, Search, Edit, KeyRound, Lock, BellOff, Archive, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  roles: string[] | null;
  is_locked: boolean | null;
  last_active_at: string | null;
  notifications_enabled: boolean | null;
  require_password_change: boolean | null;
  created_at: string | null;
};

const roleOptions = ['admin', 'supervisor', 'technician', 'accounting'] as const;

const UserManagement = () => {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.roles?.includes('admin');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editDialog, setEditDialog] = useState<{ open: boolean; user: any | null; mode: 'create' | 'edit' }>({ open: false, user: null, mode: 'create' });
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', roles: [] as string[] });
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // Presence tracking
  useEffect(() => {
    const channel = supabase.channel('online-users', {
      config: { presence: { key: 'user_id' } },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const ids = new Set<string>();
      Object.values(state).forEach((presences: any) => {
        presences.forEach((p: any) => { if (p.user_id) ids.add(p.user_id); });
      });
      setOnlineUsers(ids);
    }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin_users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('*').order('full_name');
      if (error) throw error;

      const { data: rolesData } = await supabase.from('user_roles').select('*');
      const roleMap: Record<string, string[]> = {};
      rolesData?.forEach(r => {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push(r.role);
      });

      return (data ?? []).map(u => ({ ...u, userRoles: roleMap[u.id] ?? [] }));
    },
  });

  const filteredUsers = (users ?? []).filter(u => {
    const matchSearch = !search || (u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));
    const matchRole = roleFilter === 'all' || u.userRoles?.includes(roleFilter);
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? !u.is_locked : u.is_locked);
    return matchSearch && matchRole && matchStatus;
  });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      if (form.roles.length === 0) throw new Error('At least one role is required');
      const { data: newUser, error } = await supabase.from('users').insert({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        roles: form.roles,
      }).select().single();
      if (error) throw error;

      if (form.roles.length > 0) {
        const roleInserts = form.roles.map(role => ({ user_id: newUser.id, role: role as any }));
        const { error: roleError } = await supabase.from('user_roles').insert(roleInserts);
        if (roleError) throw roleError;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin_users'] }); toast.success('User created.'); setEditDialog({ open: false, user: null, mode: 'create' }); },
    onError: (e: Error) => toast.error(e.message || 'Failed to create user.'),
  });

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!editDialog.user) return;
      if (form.roles.length === 0) throw new Error('At least one role is required');
      const userId = editDialog.user.id;
      const { error } = await supabase.from('users').update({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        roles: form.roles,
      }).eq('id', userId);
      if (error) throw error;

      await supabase.from('user_roles').delete().eq('user_id', userId);
      if (form.roles.length > 0) {
        const roleInserts = form.roles.map(role => ({ user_id: userId, role: role as any }));
        await supabase.from('user_roles').insert(roleInserts);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin_users'] }); toast.success('User updated.'); setEditDialog({ open: false, user: null, mode: 'create' }); },
    onError: (e: Error) => toast.error(e.message || 'Failed to update.'),
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ userId, lock }: { userId: string; lock: boolean }) => {
      if (lock) {
        const { data: tickets } = await supabase.from('tickets').select('id').eq('technician_id', userId).not('status', 'in', '("closed","cancelled")').limit(1);
        if (tickets && tickets.length > 0) throw new Error('has_active_tickets');
      }
      const { error } = await supabase.from('users').update({ is_locked: lock }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin_users'] }); toast.success('User status updated.'); },
    onError: (err: Error) => toast.error(err.message === 'has_active_tickets' ? 'Cannot archive: user has active tickets.' : 'Failed.'),
  });

  const forceResetMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('users').update({ require_password_change: true }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('User will be forced to change password on next login.'); qc.invalidateQueries({ queryKey: ['admin_users'] }); },
    onError: () => toast.error('Failed.'),
  });

  const toggleNotificationsMutation = useMutation({
    mutationFn: async ({ userId, enabled }: { userId: string; enabled: boolean }) => {
      const { error } = await supabase.from('users').update({ notifications_enabled: enabled }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin_users'] }); toast.success('Notifications updated.'); },
    onError: () => toast.error('Failed.'),
  });

  const openEdit = (user: any) => {
    setForm({ full_name: user.full_name ?? '', email: user.email ?? '', phone: user.phone ?? '', password: '', roles: user.userRoles ?? [] });
    setEditDialog({ open: true, user, mode: 'edit' });
  };

  const openCreate = () => {
    setForm({ full_name: '', email: '', phone: '', password: '', roles: [] });
    setEditDialog({ open: true, user: null, mode: 'create' });
  };

  const toggleRole = (role: string) => {
    setForm(prev => ({
      ...prev,
      roles: prev.roles.includes(role) ? prev.roles.filter(r => r !== role) : [...prev.roles, role],
    }));
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-xl font-bold text-foreground">User Management</h1>
        <Button size="sm" onClick={openCreate} className="bg-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1" />Create User</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email" className="pl-9 bg-secondary border-border" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-40 bg-secondary border-border"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Roles</SelectItem>{roleOptions.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40 bg-secondary border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filteredUsers.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No users found.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredUsers.map((user: any) => (
            <div key={user.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="relative shrink-0">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-secondary text-foreground text-sm">{(user.full_name ?? 'U').charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {onlineUsers.has(user.id) && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-card rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground truncate">{user.full_name ?? 'No name'}</span>
                    {user.is_locked && <Badge variant="secondary" className="text-xs">Archived</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {(user.userRoles ?? []).map((r: string) => (
                      <Badge key={r} variant="outline" className="text-xs capitalize border-primary/30 text-primary">{r}</Badge>
                    ))}
                    {user.last_active_at && (
                      <span className="text-xs text-muted-foreground hidden sm:inline">Last active: {format(new Date(user.last_active_at), 'MMM d, HH:mm')}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0 flex-wrap">
                  <button onClick={() => openEdit(user)} className="p-2 text-muted-foreground hover:text-foreground" title="Edit"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => toast.info('Reset password email would be sent to ' + user.email)} className="p-2 text-muted-foreground hover:text-foreground hidden sm:block" title="Reset Password"><KeyRound className="w-4 h-4" /></button>
                  <button onClick={() => forceResetMutation.mutate(user.id)} className="p-2 text-muted-foreground hover:text-foreground hidden sm:block" title="Force Password Reset"><Lock className="w-4 h-4" /></button>
                  <button onClick={() => toggleNotificationsMutation.mutate({ userId: user.id, enabled: !user.notifications_enabled })} className={`p-2 ${user.notifications_enabled ? 'text-muted-foreground' : 'text-destructive'} hover:text-foreground hidden sm:block`} title={user.notifications_enabled ? 'Disable Notifications' : 'Enable Notifications'}>
                    <BellOff className="w-4 h-4" />
                  </button>
                  {user.is_locked ? (
                    <button onClick={() => archiveMutation.mutate({ userId: user.id, lock: false })} className="p-2 text-muted-foreground hover:text-primary" title="Restore"><RotateCcw className="w-4 h-4" /></button>
                  ) : (
                    <button onClick={() => archiveMutation.mutate({ userId: user.id, lock: true })} className="p-2 text-muted-foreground hover:text-destructive" title="Archive"><Archive className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={o => setEditDialog(p => ({ ...p, open: o }))}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editDialog.mode === 'create' ? 'Create User' : 'Edit User'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs text-muted-foreground">Full Name *</label><Input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} className="bg-secondary border-border" /></div>
            <div><label className="text-xs text-muted-foreground">Email *</label><Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="bg-secondary border-border" /></div>
            <div><label className="text-xs text-muted-foreground">Phone</label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="bg-secondary border-border" /></div>

            {/* Roles Section */}
            <div>
              <label className="text-xs text-muted-foreground font-medium">Roles *</label>
              {isAdmin ? (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {roleOptions.map(role => (
                    <div key={role} className="flex items-center gap-2">
                      <Checkbox
                        id={`role-${role}`}
                        checked={form.roles.includes(role)}
                        onCheckedChange={() => toggleRole(role)}
                      />
                      <Label htmlFor={`role-${role}`} className="text-sm capitalize cursor-pointer">{role}</Label>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 mt-1">
                  {(editDialog.user?.userRoles ?? form.roles).map((r: string) => (
                    <Badge key={r} variant="outline" className="text-xs capitalize border-primary/30 text-primary">{r}</Badge>
                  ))}
                </div>
              )}
              {form.roles.length === 0 && isAdmin && (
                <p className="text-xs text-destructive mt-1">At least one role is required.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => editDialog.mode === 'create' ? createUserMutation.mutate() : updateUserMutation.mutate()}
              disabled={!form.full_name || !form.email || form.roles.length === 0 || createUserMutation.isPending || updateUserMutation.isPending}
              className="bg-primary text-primary-foreground">
              {(createUserMutation.isPending || updateUserMutation.isPending) ? <Spinner size="sm" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
