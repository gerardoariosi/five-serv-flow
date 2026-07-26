import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  propertyIds: string[];
  onDone?: () => void;
}

export default function AssignPMDialog({ open, onOpenChange, propertyIds, onDone }: Props) {
  const [pmId, setPmId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => { if (open) setPmId(''); }, [open]);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-assign-pm'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, company_name')
        .eq('is_deleted', false)
        .order('company_name');
      return data ?? [];
    },
    enabled: open,
  });

  const handleSave = async () => {
    if (propertyIds.length === 0) return;
    setSaving(true);
    try {
      // Load previous pms to record history
      const { data: prev } = await supabase
        .from('properties')
        .select('id, current_pm_id')
        .in('id', propertyIds);

      const newPm = pmId === '__none__' ? null : pmId || null;

      const { error } = await supabase
        .from('properties')
        .update({ current_pm_id: newPm, previous_pm_id: null })
        .in('id', propertyIds);
      if (error) throw error;

      // Reassign active tickets to new PM
      if (newPm) {
        await supabase
          .from('tickets')
          .update({ client_id: newPm })
          .in('property_id', propertyIds)
          .not('status', 'in', '("closed","cancelled")');
      }

      // Set previous_pm_id per row where it changed
      if (prev) {
        await Promise.all(
          prev
            .filter(p => (p.current_pm_id ?? null) !== newPm && p.current_pm_id)
            .map(p =>
              supabase
                .from('properties')
                .update({ previous_pm_id: p.current_pm_id })
                .eq('id', p.id)
            )
        );
      }

      toast.success(
        `${propertyIds.length} propert${propertyIds.length === 1 ? 'y' : 'ies'} ${newPm ? 'assigned' : 'unassigned'}`
      );
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['client-properties'] });
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      toast.error(e.message || 'Assignment failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Assign Property Manager ({propertyIds.length})
          </DialogTitle>
        </DialogHeader>
        <div className="py-3 space-y-2">
          <label className="text-sm text-muted-foreground">Property Manager</label>
          <Select value={pmId} onValueChange={setPmId}>
            <SelectTrigger><SelectValue placeholder="Select a PM…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">(Unassigned)</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!pmId || saving}>
            {saving ? 'Saving…' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
