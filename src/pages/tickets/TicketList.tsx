import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Filter } from 'lucide-react';
import { workTypeColors, statusLabels, statusColors } from '@/lib/ticketColors';
import Spinner from '@/components/ui/Spinner';

const TicketList = () => {
  const { activeRole } = useAuthStore();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterZone, setFilterZone] = useState('all');
  const [clients, setClients] = useState<Record<string, string>>({});
  const [properties, setProperties] = useState<Record<string, { name: string; address: string }>>({});
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const [zoneMap, setZoneMap] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [ticketRes, clientRes, propRes, zoneRes, userRes] = await Promise.all([
      supabase.from('tickets').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, company_name'),
      supabase.from('properties').select('id, name, address'),
      supabase.from('zones').select('id, name'),
      supabase.rpc('get_user_directory'),
    ]);
    setTickets(ticketRes.data ?? []);
    const cMap: Record<string, string> = {};
    (clientRes.data ?? []).forEach((c: any) => { cMap[c.id] = c.company_name ?? ''; });
    setClients(cMap);
    const pMap: Record<string, { name: string; address: string }> = {};
    (propRes.data ?? []).forEach((p: any) => { pMap[p.id] = { name: p.name ?? '', address: p.address ?? '' }; });
    setProperties(pMap);
    setZones(zoneRes.data ?? []);
    const zMap: Record<string, string> = {};
    (zoneRes.data ?? []).forEach((z: any) => { zMap[z.id] = z.name ?? ''; });
    setZoneMap(zMap);
    const uMap: Record<string, string> = {};
    (userRes.data ?? []).forEach((u: any) => { uMap[u.id] = u.full_name ?? ''; });
    setUsers(uMap);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('ticket-list-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const filtered = useMemo(() => {
    let result = tickets;
    // Accounting doesn't see drafts
    if (activeRole === 'accounting') {
      result = result.filter((t: any) => t.status !== 'draft');
    }
    if (filterStatus !== 'all') result = result.filter((t: any) => t.status === filterStatus);
    if (filterType !== 'all') result = result.filter((t: any) => t.work_type === filterType);
    if (filterZone !== 'all') result = result.filter((t: any) => t.zone_id === filterZone);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((t: any) =>
        t.fs_number?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        (t.client_id && clients[t.client_id]?.toLowerCase().includes(q)) ||
        (t.property_id && properties[t.property_id]?.name.toLowerCase().includes(q)) ||
        (t.technician_id && users[t.technician_id]?.toLowerCase().includes(q))
      );
    }
    // Emergencies first
    result.sort((a: any, b: any) => {
      if (a.work_type === 'emergency' && b.work_type !== 'emergency') return -1;
      if (b.work_type === 'emergency' && a.work_type !== 'emergency') return 1;
      return 0;
    });
    return result;
  }, [tickets, search, filterStatus, filterType, filterZone, activeRole, clients, properties, users]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Tickets</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-1" /> Filters
          </Button>
          {(activeRole === 'admin' || activeRole === 'supervisor') && (
            <Button size="sm" onClick={() => navigate('/tickets/new')}>
              <Plus className="w-4 h-4 mr-1" /> New Ticket
            </Button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(statusLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="make-ready">Make-Ready</SelectItem>
              <SelectItem value="emergency">Emergency</SelectItem>
              <SelectItem value="repair">Repair</SelectItem>
              <SelectItem value="capex">CapEx</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterZone} onValueChange={setFilterZone}>
            <SelectTrigger><SelectValue placeholder="Zone" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No tickets found</div>
        ) : (
          filtered.map((ticket: any) => {
            const colors = workTypeColors[ticket.work_type ?? 'repair'] ?? workTypeColors.repair;
            const isEmergency = ticket.work_type === 'emergency';
            return (
              <button
                key={ticket.id}
                onClick={() => navigate(`/tickets/${ticket.id}`)}
                className={`w-full text-left p-4 rounded-lg border ${isEmergency ? 'border-destructive bg-destructive/10' : colors.border + ' ' + colors.bg} transition-colors hover:opacity-90`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-foreground">{ticket.fs_number ?? 'No FS#'}</span>
                      <Badge className={`text-[10px] ${colors.badge}`}>{(ticket.work_type ?? 'repair').replace('-', ' ').toUpperCase()}</Badge>
                      <Badge className={`text-[10px] ${statusColors[ticket.status ?? 'draft']}`}>{statusLabels[ticket.status ?? 'draft']}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {ticket.property_id ? properties[ticket.property_id]?.name : ''}
                      {ticket.unit ? ` · Unit ${ticket.unit}` : ''}
                      {ticket.client_id ? ` · ${clients[ticket.client_id]}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {ticket.technician_id ? users[ticket.technician_id] : <span className="text-destructive font-medium">Unassigned</span>}
                    </p>
                    {ticket.appointment_time && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(ticket.appointment_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TicketList;
