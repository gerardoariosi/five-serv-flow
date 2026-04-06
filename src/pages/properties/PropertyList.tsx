import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MapPin, Building2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Spinner from '@/components/ui/Spinner';

const PropertyList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');

  const { data: zones } = useQuery({
    queryKey: ['zones-list'],
    queryFn: async () => {
      const { data } = await supabase.from('zones').select('id, name').eq('status', 'active').order('name');
      return data ?? [];
    },
  });

  const { data: properties, isLoading } = useQuery({
    queryKey: ['properties', search, zoneFilter, statusFilter],
    queryFn: async () => {
      let query = supabase.from('properties').select('*, zones(name), clients!properties_current_pm_id_fkey(company_name)');
      if (search) query = query.or(`name.ilike.%${search}%,address.ilike.%${search}%`);
      if (zoneFilter !== 'all') query = query.eq('zone_id', zoneFilter);
      query = query.eq('status', statusFilter).order('name');

      const { data, error } = await query;
      if (error) throw error;

      // Get ticket counts
      const propIds = (data ?? []).map(p => p.id);
      const { data: tickets } = await supabase.from('tickets').select('property_id').in('property_id', propIds).not('status', 'in', '("closed","cancelled")');
      const ticketMap: Record<string, number> = {};
      tickets?.forEach(t => { ticketMap[t.property_id!] = (ticketMap[t.property_id!] || 0) + 1; });

      return (data ?? []).map(p => ({ ...p, activeTickets: ticketMap[p.id] ?? 0 }));
    },
  });

  return (
    <div className="p-4 max-w-4xl mx-auto">
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

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : properties?.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No properties found.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {properties?.map(p => (
            <div key={p.id} onClick={() => navigate(`/properties/${p.id}`)} className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-primary/30 transition-colors">
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
          ))}
        </div>
      )}
    </div>
  );
};

export default PropertyList;
