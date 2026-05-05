import { useState, useMemo } from 'react';
import { Plus, Edit, Power, MoreVertical, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Spinner from '@/components/ui/Spinner';
import BulkActionBar from '@/components/ui/BulkActionBar';
import BulkDeleteDialog from '@/components/ui/BulkDeleteDialog';
import { toast } from 'sonner';

const ZoneList = () => {
  const queryClient = useQueryClient();
  const { activeRole } = useAuthStore();
  const canDelete = activeRole === 'admin';
  const [dialog, setDialog] = useState<{ open: boolean; mode: 'create' | 'rename'; zoneId?: string; name: string }>({ open: false, mode: 'create', name: '' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState(false);
  const [singleDelete, setSingleDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: zones, isLoading } = useQuery({
    queryKey: ['zones'],
    queryFn: async () => {
      const { data: z, error } = await supabase.from('zones').select('*').eq('is_deleted', false).order('name');
      if (error) throw error;

      const zoneIds = (z ?? []).map(zone => zone.id);
      const { data: props } = await supabase.from('properties').select('zone_id').in('zone_id', zoneIds);
      const propMap: Record<string, number> = {};
      props?.forEach(p => { propMap[p.zone_id!] = (propMap[p.zone_id!] || 0) + 1; });

      return (z ?? []).map(zone => ({ ...zone, propertyCount: propMap[zone.id] ?? 0 }));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (dialog.mode === 'create') {
        const { error } = await supabase.from('zones').insert({ name: dialog.name });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('zones').update({ name: dialog.name }).eq('id', dialog.zoneId!);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      toast.success(dialog.mode === 'create' ? 'Zone created.' : 'Zone renamed.');
      setDialog({ open: false, mode: 'create', name: '' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to save zone.'),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ zoneId, currentStatus }: { zoneId: string; currentStatus: string }) => {
      if (currentStatus === 'active') {
        const { data: tickets } = await supabase.from('tickets').select('id').eq('zone_id', zoneId).not('status', 'in', '("closed","cancelled")').limit(1);
        if (tickets && tickets.length > 0) throw new Error('active_tickets');
      }
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const { error } = await supabase.from('zones').update({ status: newStatus }).eq('id', zoneId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      toast.success('Zone status updated.');
    },
    onError: (err: Error) => {
      if (err.message === 'active_tickets') toast.error('Cannot deactivate: zone has active tickets.');
      else toast.error('Failed to update zone.');
    },
  });

  const performSoftDelete = async (ids: string[]) => {
    setDeleting(true);
    const { error } = await supabase.from('zones').update({ is_deleted: true, deleted_at: new Date().toISOString() }).in('id', ids);
    setDeleting(false);
    if (error) { toast.error('Delete failed'); return false; }
    toast.success(`${ids.length} zone${ids.length === 1 ? '' : 's'} deleted`);
    queryClient.invalidateQueries({ queryKey: ['zones'] });
    return true;
  };

  const toggleSelect = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(p => p.size === (zones?.length ?? 0) ? new Set() : new Set((zones ?? []).map(z => z.id)));

  const selectedNames = useMemo(() => (zones ?? []).filter(z => selected.has(z.id)).map(z => z.name ?? ''), [zones, selected]);

  return (
    <div className="p-4 max-w-4xl mx-auto pb-28">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-foreground">Zones</h1>
        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setDialog({ open: true, mode: 'create', name: '' })}>
          <Plus className="w-4 h-4 mr-1" /> New
        </Button>
      </div>

      {canDelete && zones && zones.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <Checkbox checked={selected.size > 0 && selected.size === zones.length} onCheckedChange={toggleAll} />
          <span className="text-xs text-muted-foreground">Select all ({zones.length})</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : zones?.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No zones created yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {zones?.map(zone => (
            <div key={zone.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between gap-3 group">
              {canDelete && (
                <Checkbox
                  checked={selected.has(zone.id)}
                  onCheckedChange={() => toggleSelect(zone.id)}
                  className="md:opacity-0 md:group-hover:opacity-100 data-[state=checked]:opacity-100 transition-opacity"
                />
              )}
              <div className="flex-1 min-w-0">
                <span className="font-medium text-foreground">{zone.name}</span>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground">{zone.propertyCount} properties</span>
                  <Badge variant={zone.status === 'active' ? 'default' : 'secondary'} className="text-xs">{zone.status}</Badge>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setDialog({ open: true, mode: 'rename', zoneId: zone.id, name: zone.name ?? '' })} className="p-2 text-muted-foreground hover:text-foreground">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => toggleMutation.mutate({ zoneId: zone.id, currentStatus: zone.status ?? 'active' })} className="p-2 text-muted-foreground hover:text-foreground">
                  <Power className="w-4 h-4" />
                </button>
                {canDelete && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-destructive" onClick={() => setSingleDelete({ id: zone.id, name: zone.name ?? '' })}>
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialog.open} onOpenChange={(o) => setDialog(p => ({ ...p, open: o }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialog.mode === 'create' ? 'New Zone' : 'Rename Zone'}</DialogTitle></DialogHeader>
          <Input value={dialog.name} onChange={e => setDialog(p => ({ ...p, name: e.target.value }))} placeholder="Zone name" className="bg-secondary border-border" />
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate()} disabled={!dialog.name || saveMutation.isPending} className="bg-primary text-primary-foreground">
              {saveMutation.isPending ? <Spinner size="sm" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkDeleteDialog
        open={!!singleDelete}
        onOpenChange={(o) => !o && setSingleDelete(null)}
        itemNames={singleDelete ? [singleDelete.name] : []}
        totalCount={1}
        loading={deleting}
        onConfirm={async () => {
          if (!singleDelete) return;
          const ok = await performSoftDelete([singleDelete.id]);
          if (ok) setSingleDelete(null);
        }}
      />

      <BulkDeleteDialog
        open={bulkDialog}
        onOpenChange={setBulkDialog}
        itemNames={selectedNames}
        totalCount={selected.size}
        loading={deleting}
        onConfirm={async () => {
          const ok = await performSoftDelete(Array.from(selected));
          if (ok) { setSelected(new Set()); setBulkDialog(false); }
        }}
      />

      {canDelete && (
        <BulkActionBar
          count={selected.size}
          itemNoun="zone"
          deleting={deleting}
          onDelete={() => setBulkDialog(true)}
          onClear={() => setSelected(new Set())}
        />
      )}
    </div>
  );
};

export default ZoneList;
