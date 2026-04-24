import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Ticket, FileEdit, UserX, PauseCircle, AlertTriangle, Clock, Plus } from 'lucide-react';
import { workTypeColors, statusLabels, statusColors } from '@/lib/ticketColors';
import SkeletonCard from '@/components/ui/SkeletonCard';
import EmptyState from '@/components/ui/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

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

const workTypeBorder: Record<string, string> = {
  emergency: 'border-l-[#ef4444]',
  'make-ready': 'border-l-[#f97316]',
  make_ready: 'border-l-[#f97316]',
  repair: 'border-l-[#3b82f6]',
  capex: 'border-l-[#22c55e]',
};

const QUICK_FILTERS = [
  { key: 'all',          label: 'All' },
  { key: 'unassigned',   label: 'Unassigned' },
  { key: 'emergencies',  label: 'Emergencies' },
  { key: 'make-ready',   label: 'Make-Ready' },
  { key: 'high',         label: 'High Priority' },
] as const;

type QuickFilter = typeof QUICK_FILTERS[number]['key'];

const Dashboard = () => {
  const { activeRole } = useAuthStore();
  const navigate = useNavigate();
  const isTechnician = activeRole === 'technician';
  const searchRef = useRef<HTMLInputElement>(null);

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [clients, setClients] = useState<Record<string, string>>({});
  const [properties, setProperties] = useState<Record<string, { name: string; address: string }>>({});
  const [zones, setZones] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<Record<string, string>>({});
  const [technicianIds, setTechnicianIds] = useState<string[]>([]);

  // Quick-create modal state
  const canQuickCreate = activeRole === 'admin' || activeRole === 'supervisor';
  const [quickOpen, setQuickOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [propertySearch, setPropertySearch] = useState('');
  const [qcWorkType, setQcWorkType] = useState('repair');
  const [qcPriority, setQcPriority] = useState('normal');
  const [qcPropertyId, setQcPropertyId] = useState('');
  const [qcUnit, setQcUnit] = useState('');
  const [qcTechnicianId, setQcTechnicianId] = useState('');
  const [qcDescription, setQcDescription] = useState('');

  const fetchData = useCallback(async () => {
    const [ticketRes, clientRes, propRes, zoneRes, userRes, techRolesRes] = await Promise.all([
      supabase.from('tickets').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, company_name'),
      supabase.from('properties').select('id, name, address'),
      supabase.from('zones').select('id, name'),
      supabase.rpc('get_user_directory'),
      supabase.from('user_roles').select('user_id').eq('role', 'technician'),
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
    setTechnicianIds(((techRolesRes.data ?? []) as any[]).map((r) => r.user_id));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('tickets-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => fetchData())
      .subscribe();
    const handleVisibility = () => { if (document.visibilityState === 'visible') fetchData(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchData]);

  // Focus search via global '/' shortcut
  useEffect(() => {
    const handler = () => searchRef.current?.focus();
    window.addEventListener('focus-search', handler);
    return () => window.removeEventListener('focus-search', handler);
  }, []);

  const filteredTickets = useMemo(() => {
    let result = tickets;
    if (activeRole === 'accounting') result = result.filter(t => t.status !== 'draft');

    // Quick filters
    if (quickFilter === 'unassigned') {
      result = result.filter(t => !t.technician_id && !['closed', 'cancelled', 'draft'].includes(t.status ?? ''));
    } else if (quickFilter === 'emergencies') {
      result = result.filter(t => t.work_type === 'emergency');
    } else if (quickFilter === 'make-ready') {
      result = result.filter(t => t.work_type === 'make-ready' || t.work_type === 'make_ready');
    } else if (quickFilter === 'high') {
      result = result.filter(t => t.priority === 'high' || t.priority === 'urgent');
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

    const priorityRank = (p: string | null) => (p === 'urgent' ? 0 : p === 'high' ? 1 : 2);
    result = [...result].sort((a, b) => {
      if (a.work_type === 'emergency' && b.work_type !== 'emergency') return -1;
      if (b.work_type === 'emergency' && a.work_type !== 'emergency') return 1;
      return priorityRank(a.priority) - priorityRank(b.priority);
    });

    return result;
  }, [tickets, search, quickFilter, activeRole, clients, properties, zones, users]);

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
    { label: 'Active',      value: metrics.active,          icon: Ticket,         color: 'text-primary',          bg: 'bg-primary/10' },
    { label: 'Drafts',      value: metrics.draft,           icon: FileEdit,       color: 'text-muted-foreground', bg: 'bg-muted/40' },
    { label: 'Unassigned',  value: metrics.unassigned,      icon: UserX,          color: 'text-orange-400',       bg: 'bg-orange-400/10' },
    { label: 'Paused',      value: metrics.paused,          icon: PauseCircle,    color: 'text-yellow-400',       bg: 'bg-yellow-400/10' },
    { label: 'Emergencies', value: metrics.emergencies,     icon: AlertTriangle,  color: 'text-destructive',      bg: 'bg-destructive/10' },
    { label: 'For Review',  value: metrics.pmNotResponding, icon: Clock,          color: 'text-purple-400',       bg: 'bg-purple-400/10' },
  ];

  if (isTechnician) return <Navigate to="/my-work" replace />;

  const technicianOptions = technicianIds
    .map((id) => ({ id, name: users[id] || 'Unnamed' }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const propertyOptionsList = (() => {
    const list = Object.entries(properties).map(([id, p]) => ({ id, name: p.name, address: p.address }));
    const q = propertySearch.trim().toLowerCase();
    const filtered = q
      ? list.filter((p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q))
      : list;
    return filtered.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 50);
  })();

  const resetQuickForm = () => {
    setQcWorkType('repair');
    setQcPriority('normal');
    setQcPropertyId('');
    setQcUnit('');
    setQcTechnicianId('');
    setQcDescription('');
    setPropertySearch('');
  };

  const handleQuickCreate = async () => {
    if (!qcPropertyId) { toast.error('Select a property'); return; }
    setCreating(true);
    const { data: fsData } = await supabase.rpc('generate_fs_number');
    const { error } = await supabase.from('tickets').insert({
      fs_number: fsData ?? null,
      work_type: qcWorkType,
      priority: qcPriority,
      property_id: qcPropertyId,
      unit: qcUnit || null,
      technician_id: qcTechnicianId || null,
      description: qcDescription || null,
      status: 'open',
    });
    setCreating(false);
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    toast.success('Ticket created');
    setQuickOpen(false);
    resetQuickForm();
    fetchData();
  };

  return (
    <div className="p-4 space-y-4">
      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {metricCards.map((m) => (
          <div key={m.label} className="fs-card p-3 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-md ${m.bg} flex items-center justify-center shrink-0`}>
              <m.icon className={`w-4 h-4 ${m.color}`} />
            </div>
            <div className="min-w-0 flex flex-col">
              <span className={`text-2xl font-bold tracking-tight ${m.color} leading-none`}>{m.value}</span>
              <span className="fs-data-label mt-1 truncate">{m.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={searchRef}
          placeholder="Search FS#, PM, property, zone, technician, notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Quick filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {QUICK_FILTERS.map((f) => {
          const active = quickFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setQuickFilter(f.key)}
              className={`fs-chip ${active ? 'fs-chip-active' : 'fs-chip-inactive'}`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Ticket list */}
      <div className="space-y-2">
        {loading ? (
          <SkeletonCard count={5} />
        ) : filteredTickets.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title="No tickets found"
            description={search || quickFilter !== 'all' ? 'Try clearing filters or searching for something else.' : 'Create your first ticket to get started.'}
            actionLabel={(activeRole === 'admin' || activeRole === 'supervisor') ? 'Create Ticket' : undefined}
            onAction={() => navigate('/tickets/new')}
          />
        ) : (
          filteredTickets.map((ticket) => {
            const colors = workTypeColors[ticket.work_type ?? 'repair'] ?? workTypeColors.repair;
            const leftBorder = workTypeBorder[ticket.work_type ?? 'repair'] ?? 'border-l-muted-foreground';
            return (
              <button
                key={ticket.id}
                onClick={() => navigate(`/tickets/${ticket.id}`)}
                className={`w-full text-left fs-card border-l-[3px] ${leftBorder} py-3 px-4 active:scale-[0.99] transition-transform duration-100 space-y-1.5`}
              >
                {/* Zone 1: identity + badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-foreground tracking-tight">{ticket.fs_number ?? 'No FS#'}</span>
                  <Badge className={`text-[10px] ring-1 ring-current/20 ${colors.badge}`}>
                    {(ticket.work_type ?? 'repair').replace('-', ' ').toUpperCase()}
                  </Badge>
                  <Badge className={`text-[10px] ring-1 ring-current/20 ${statusColors[ticket.status ?? 'draft']}`}>
                    {statusLabels[ticket.status ?? 'draft']}
                  </Badge>
                  {ticket.priority && ticket.priority !== 'normal' && (
                    <Badge
                      className={`text-[10px] ring-1 ring-current/20 ${
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
                </div>

                {/* Zone 2: location */}
                <p className="text-sm truncate">
                  {ticket.property_id && (
                    <span className="font-semibold text-foreground">{properties[ticket.property_id]?.name}</span>
                  )}
                  {ticket.unit && <span className="text-muted-foreground"> · Unit {ticket.unit}</span>}
                  {ticket.client_id && <span className="text-muted-foreground"> · {clients[ticket.client_id]}</span>}
                </p>

                {/* Zone 3: technician + appointment */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {ticket.technician_id ? users[ticket.technician_id] : <span className="text-destructive font-medium">Unassigned</span>}
                  </span>
                  {ticket.appointment_time && (
                    <span>
                      {new Date(ticket.appointment_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Floating new-ticket FAB on mobile */}
      {(activeRole === 'admin' || activeRole === 'supervisor') && (
        <Button
          onClick={() => navigate('/tickets/new')}
          className="md:hidden fixed bottom-4 right-4 h-12 w-12 rounded-full p-0 shadow-lg z-20"
          aria-label="New ticket"
        >
          <Plus className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
};

export default Dashboard;
