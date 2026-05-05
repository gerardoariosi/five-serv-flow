import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MapPin, Building2, MoreVertical, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Spinner from '@/components/ui/Spinner';
import BulkActionBar from '@/components/ui/BulkActionBar';
import BulkDeleteDialog from '@/components/ui/BulkDeleteDialog';
import { toast } from 'sonner';

const PropertyList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeRole } = useAuthStore();
  const canDelete = activeRole === 'admin';
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState(false);
  const [singleDelete, setSingleDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: zones } = useQuery({
    queryKey: ['zones-list'],
    queryFn: async () => {
      const { data } = await supabase.from('zones').select('id, name').eq('status', 'active').eq('is_deleted', false).order('name');
      return data ?? [];
    },
  });

  const { data: properties, isLoading } = useQuery({
    queryKey: ['properties', search, zoneFilter, statusFilter],
    queryFn: async () => {
      let query = supabase.from('properties').select('*, zones(name), clients!properties_current_pm_id_fkey(company_name)').eq('is_deleted', false);
      if (search) query = query.or(`name.ilike.%${search}%,address.ilike.%${search}%`);
      if (zoneFilter !== 'all') query = query.eq('zone_id', zoneFilter);
      query = query.eq('status', statusFilter).order('name');

      const { data, error } = await query;
      if (error) throw error;

      const propIds = (data ?? []).map(p => p.id);
      const { data: tickets } = await supabase.from('tickets').select('property_id').in('property_id', propIds).not('status', 'in', '("closed","cancelled")');
      const ticketMap: Record<string, number> = {};
      tickets?.forEach(t => { ticketMap[t.property_id!] = (ticketMap[t.property_id!] || 0) + 1; });

      return (data ?? []).map(p => ({ ...p, activeTickets: ticketMap[p.id] ?? 0 }));
    },
  });

  const performSoftDelete = async (ids: string[]) => {
    setDeleting(true);
    const { error } = await supabase.from('properties').update({ is_deleted: true, deleted_at: new Date().toISOString(), status: 'inactive' }).in('id', ids);
    setDeleting(false);
    if (error) { toast.error('Delete failed'); return false; }
    toast.success(`${ids.length} propert${ids.length === 1 ? 'y' : 'ies'} deleted`);
    queryClient.invalidateQueries({ queryKey: ['properties'] });
    return true;
  };

  const toggleSelect = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(p => p.size === (properties?.length ?? 0) ? new Set() : new Set((properties ?? []).map(x => x.id)));
  const selectedNames = useMemo(() => (properties ?? []).filter(p => selected.has(p.id)).map(p => p.name ?? p.address ?? ''), [properties, selected]);

  return (
    <div className="p-4 max-w-4xl mx-auto pb-28">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-foreground">Properties</h1>
        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => navigate('/properties/new')}>
          <Plus className="w-4 h-4 mr-1" /> New
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search properties..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border" />
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <Select value={zoneFilter} onValueChange={setZoneFilter}>
          <SelectTrigger className="w-40 bg-secondary border-border"><SelectValue placeholder="Zone" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Zones</SelectItem>
            {zones?.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {(['active', 'inactive'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {canDelete && properties && properties.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <Checkbox checked={selected.size > 0 && selected.size === properties.length} onCheckedChange={toggleAll} />
          <span className="text-xs text-muted-foreground">Select all ({properties.length})</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : properties?.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No properties found.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {properties?.map(p => (
            <div key={p.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors group flex gap-3">
              {canDelete && (
                <Checkbox
                  checked={selected.has(p.id)}
                  onCheckedChange={() => toggleSelect(p.id)}
                  className="mt-1 md:opacity-0 md:group-hover:opacity-100 data-[state=checked]:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/properties/${p.id}`)}>
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span className="font-bold text-foreground">{p.name || p.address}</span>
                </div>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground ml-6">
                  <span>{(p as any).zones?.name ?? 'No zone'}</span>
                  <span>{(p as any).clients?.company_name ?? 'No PM'}</span>
                  {p.address && (
                    <a href={`https://maps.google.com/?q=${encodeURIComponent(p.address)}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-1 hover:text-primary">
                      <MapPin className="w-3 h-3" />{p.address}
                    </a>
                  )}
                </div>
                <div className="ml-6 mt-2">
                  <Badge variant="outline" className="text-xs">{p.activeTickets} active tickets</Badge>
                </div>
              </div>
              {canDelete && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreVertical className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-destructive" onClick={() => setSingleDelete({ id: p.id, name: p.name ?? p.address ?? '' })}>
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      )}

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
          itemNoun="property"
          deleting={deleting}
          onDelete={() => setBulkDialog(true)}
          onClear={() => setSelected(new Set())}
        />
      )}
    </div>
  );
};

export default PropertyList;
