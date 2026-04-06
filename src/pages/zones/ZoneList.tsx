import { useState } from 'react';
import { Plus, Edit, Power } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import Spinner from '@/components/ui/Spinner';
import { toast } from 'sonner';

const ZoneList = () => {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; mode: 'create' | 'rename'; zoneId?: string; name: string }>({ open: false, mode: 'create', name: '' });

  const { data: zones, isLoading } = useQuery({
    queryKey: ['zones'],
    queryFn: async () => {
      const { data: z, error } = await supabase.from('zones').select('*').order('name');
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
    onError: () => toast.error('Failed to save zone.'),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ zoneId, currentStatus }: { zoneId: string; currentStatus: string }) => {
      if (currentStatus === 'active') {
        // Check for active tickets
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
      if (err.message === 'active_tickets') {
        toast.error('Cannot deactivate: zone has active tickets.');
      } else {
        toast.error('Failed to update zone.');
      }
    },
  });

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-foreground">Zones</h1>
        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setDialog({ open: true, mode: 'create', name: '' })}>
          <Plus className="w-4 h-4 mr-1" /> New
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : zones?.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No zones created yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {zones?.map(zone => (
            <div key={zone.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
              <div>
                <span className="font-medium text-foreground">{zone.name}</span>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground">{zone.propertyCount} properties</span>
                  <Badge variant={zone.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                    {zone.status}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setDialog({ open: true, mode: 'rename', zoneId: zone.id, name: zone.name ?? '' })} className="p-2 text-muted-foreground hover:text-foreground">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => toggleMutation.mutate({ zoneId: zone.id, currentStatus: zone.status ?? 'active' })} className="p-2 text-muted-foreground hover:text-foreground">
                  <Power className="w-4 h-4" />
                </button>
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
    </div>
  );
};

export default ZoneList;
