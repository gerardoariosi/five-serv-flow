import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Ticket, FileEdit, UserX, PauseCircle, AlertTriangle, Clock } from 'lucide-react';
import { workTypeColors, statusLabels, statusColors } from '@/lib/ticketColors';
import Spinner from '@/components/ui/Spinner';

interface TicketRow {
  id: string;
  fs_number: string | null;
  work_type: string | null;
  status: string | null;
  priority: string | null;
  description: string | null;
  appointment_time: string | null;
  technician_id: string | null;
  client_id: string | null;
  property_id: string | null;
  zone_id: string | null;
  unit: string | null;
  created_at: string | null;
  internal_note: string | null;
}

const Dashboard = () => {
  const { activeRole } = useAuthStore();
  const navigate = useNavigate();
  const isTechnician = activeRole === 'technician';

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<Record<string, string>>({});
  const [properties, setProperties] = useState<Record<string, { name: string; address: string }>>({});
  const [zones, setZones] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<Record<string, string>>({});
  const [savedFilters, setSavedFilters] = useState<{ id: string; name: string; filters: any }[]>([]);
  const [activeFilter, setActiveFilter] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [ticketRes, clientRes, propRes, zoneRes, userRes, filterRes] = await Promise.all([
      supabase.from('tickets').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, company_name'),
      supabase.from('properties').select('id, name, address'),
      supabase.from('zones').select('id, name'),
      supabase.rpc('get_user_directory'),
      supabase.from('user_saved_filters').select('*'),
    ]);

    setTickets((ticketRes.data ?? []) as TicketRow[]);
    const cMap: Record<string, string> = {};
    (clientRes.data ?? []).forEach((c: any) => { cMap[c.id] = c.company_name ?? ''; });
    setClients(cMap);
    const pMap: Record<string, { name: string; address: string }> = {};
    (propRes.data ?? []).forEach((p: any) => { pMap[p.id] = { name: p.name ?? '', address: p.address ?? '' }; });
    setProperties(pMap);
    const zMap: Record<string, string> = {};
    (zoneRes.data ?? []).forEach((z: any) => { zMap[z.id] = z.name ?? ''; });
    setZones(zMap);
    const uMap: Record<string, string> = {};
    (userRes.data ?? []).forEach((u: any) => { uMap[u.id] = u.full_name ?? ''; });
    setUsers(uMap);
    setSavedFilters((filterRes.data ?? []).map((f: any) => ({ id: f.id, name: f.name, filters: f.filters })));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('tickets-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        fetchData();
      })
      .subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchData();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchData]);

  const filteredTickets = useMemo(() => {
    let result = tickets;

    // Accounting doesn't see drafts
    if (activeRole === 'accounting') {
      result = result.filter(t => t.status !== 'draft');
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        (t.fs_number?.toLowerCase().includes(q)) ||
        (t.description?.toLowerCase().includes(q)) ||
        (t.internal_note?.toLowerCase().includes(q)) ||
        (t.unit?.toLowerCase().includes(q)) ||
        (t.client_id && clients[t.client_id]?.toLowerCase().includes(q)) ||
        (t.property_id && properties[t.property_id]?.name.toLowerCase().includes(q)) ||
        (t.property_id && properties[t.property_id]?.address.toLowerCase().includes(q)) ||
        (t.zone_id && zones[t.zone_id]?.toLowerCase().includes(q)) ||
        (t.technician_id && users[t.technician_id]?.toLowerCase().includes(q))
      );
    }

    // Emergencies first, then high-priority
    const priorityRank = (p: string | null) => (p === 'urgent' ? 0 : p === 'high' ? 1 : 2);
    result.sort((a, b) => {
      if (a.work_type === 'emergency' && b.work_type !== 'emergency') return -1;
      if (b.work_type === 'emergency' && a.work_type !== 'emergency') return 1;
      return priorityRank(a.priority) - priorityRank(b.priority);
    });

    return result;
  }, [tickets, search, activeRole, clients, properties, zones, users]);

  const metrics = useMemo(() => {
    const active = tickets.filter(t => !['closed', 'cancelled', 'draft'].includes(t.status ?? ''));
    return {
      active: active.length,
      draft: tickets.filter(t => t.status === 'draft').length,
      unassigned: active.filter(t => !t.technician_id).length,
      paused: tickets.filter(t => t.status === 'paused').length,
      emergencies: active.filter(t => t.work_type === 'emergency').length,
      pmNotResponding: tickets.filter(t => t.status === 'ready_for_review').length,
    };
  }, [tickets]);

  const metricCards = [
    { label: 'Active Tickets', value: metrics.active, icon: Ticket, color: 'text-primary' },
    { label: 'Drafts', value: metrics.draft, icon: FileEdit, color: 'text-muted-foreground' },
    { label: 'Unassigned', value: metrics.unassigned, icon: UserX, color: 'text-orange-400' },
    { label: 'Paused', value: metrics.paused, icon: PauseCircle, color: 'text-yellow-400' },
    { label: 'Emergencies', value: metrics.emergencies, icon: AlertTriangle, color: 'text-destructive' },
    { label: 'PM Not Responding', value: metrics.pmNotResponding, icon: Clock, color: 'text-purple-400' },
  ];

  if (isTechnician) {
    return <Navigate to="/my-work" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {metricCards.map((m) => (
          <div key={m.label} className="bg-card border border-border rounded-lg p-2 sm:p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <m.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${m.color} shrink-0`} />
              <span className="text-[10px] sm:text-xs text-muted-foreground truncate">{m.label}</span>
            </div>
            <span className={`text-xl sm:text-2xl font-bold ${m.color}`}>{m.value}</span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search FS#, PM, property, zone, technician, notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Saved filter chips */}
      {savedFilters.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {savedFilters.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.filters)}
              className="px-3 py-1 text-xs rounded-full border border-border bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {/* Ticket list */}
      <div className="space-y-2">
        {filteredTickets.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No tickets found</div>
        ) : (
          filteredTickets.map((ticket) => {
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
                      <span className="font-mono text-sm font-bold text-foreground">
                        {ticket.fs_number ?? 'No FS#'}
                      </span>
                      <Badge className={`text-[10px] ${colors.badge}`}>
                        {(ticket.work_type ?? 'repair').replace('-', ' ').toUpperCase()}
                      </Badge>
                      <Badge className={`text-[10px] ${statusColors[ticket.status ?? 'draft']}`}>
                        {statusLabels[ticket.status ?? 'draft']}
                      </Badge>
                      {ticket.priority && ticket.priority !== 'normal' && (
                        <Badge
                          className={`text-[10px] ${
                            ticket.priority === 'urgent'
                              ? 'bg-destructive text-destructive-foreground'
                              : ticket.priority === 'high'
                              ? 'bg-orange-500 text-white'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {ticket.priority.toUpperCase()}
                        </Badge>
                      )}
                      {ticket.status === 'draft' && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted-foreground">
                          DRAFT
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {ticket.property_id ? properties[ticket.property_id]?.name : ''}
                      {ticket.unit ? ` · Unit ${ticket.unit}` : ''}
                      {ticket.client_id ? ` · ${clients[ticket.client_id]}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {ticket.technician_id ? users[ticket.technician_id] : (
                        <span className="text-destructive font-medium">Unassigned</span>
                      )}
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

export default Dashboard;
