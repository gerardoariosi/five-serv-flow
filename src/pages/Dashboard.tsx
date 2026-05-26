import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Ticket, Plus, ClipboardList } from 'lucide-react';
import { workTypeColors, statusLabels, statusColors } from '@/lib/ticketColors';
import SkeletonCard from '@/components/ui/SkeletonCard';
import EmptyState from '@/components/ui/EmptyState';
import StatusPill from '@/components/ui/StatusPill';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { inspectionStatusColors, inspectionStatusLabels } from '@/lib/inspectionColors';

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

interface InspectionRow {
  id: string;
  ins_number: string | null;
  status: string | null;
  property_id: string | null;
  assigned_to: string | null;
  visit_date: string | null;
  created_at: string | null;
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
  const { activeRole, user } = useAuthStore();
  const navigate = useNavigate();
  const isTechnician = activeRole === 'technician';
  const searchRef = useRef<HTMLInputElement>(null);

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [clients, setClients] = useState<Record<string, string>>({});
  const [properties, setProperties] = useState<Record<string, { name: string; address: string; current_pm_id: string | null }>>({});
  const [zones, setZones] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<Record<string, string>>({});
  const [technicianIds, setTechnicianIds] = useState<string[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string[]>>({});

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
    const [ticketRes, inspRes, clientRes, propRes, zoneRes, userRes, techRolesRes] = await Promise.all([
      supabase.from('tickets').select('*').eq('is_deleted', false).order('created_at', { ascending: false }),
      supabase.from('inspections').select('*').eq('is_deleted', false).order('created_at', { ascending: false }),
      supabase.from('clients').select('id, company_name'),
      supabase.from('properties').select('id, name, address, current_pm_id'),
      supabase.from('zones').select('id, name'),
      supabase.rpc('get_user_directory'),
      supabase.from('user_roles').select('user_id, role'),
    ]);
    setTickets((ticketRes.data ?? []) as TicketRow[]);
    setInspections((inspRes.data ?? []) as InspectionRow[]);
    const cMap: Record<string, string> = {};
    (clientRes.data ?? []).forEach((c: any) => { cMap[c.id] = c.company_name ?? c.contact_name ?? ''; });
    setClients(cMap);
    const pMap: Record<string, { name: string; address: string; current_pm_id: string | null }> = {};
    (propRes.data ?? []).forEach((p: any) => { pMap[p.id] = { name: p.name ?? '', address: p.address ?? '', current_pm_id: p.current_pm_id ?? null }; });
    setProperties(pMap);
    const zMap: Record<string, string> = {};
    (zoneRes.data ?? []).forEach((z: any) => { zMap[z.id] = z.name ?? ''; });
    setZones(zMap);
    const uMap: Record<string, string> = {};
    (userRes.data ?? []).forEach((u: any) => { uMap[u.id] = u.full_name ?? ''; });
    setUsers(uMap);
    const rolesMap: Record<string, string[]> = {};
    ((techRolesRes.data ?? []) as any[]).forEach((r) => {
      if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
      rolesMap[r.user_id].push(r.role);
    });
    setUserRoles(rolesMap);
    setTechnicianIds(Object.keys(uMap));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('tickets-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inspections' }, () => fetchData())
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
      insScheduled: inspections.filter(i => i.status === 'scheduled').length,
      insPending: inspections.filter(i => i.status === 'sent').length,
      insResponded: inspections.filter(i => i.status === 'responded').length,
    };
  }, [tickets, inspections]);

  const ticketMetrics = [
    { label: 'Active',      value: metrics.active,          color: 'text-primary',          border: 'border-l-primary' },
    { label: 'Drafts',      value: metrics.draft,           color: 'text-muted-foreground', border: 'border-l-border' },
    { label: 'Unassigned',  value: metrics.unassigned,      color: 'text-orange-400',       border: 'border-l-orange-400' },
    { label: 'Paused',      value: metrics.paused,          color: 'text-yellow-400',       border: 'border-l-yellow-400' },
    { label: 'Emergencies', value: metrics.emergencies,     color: 'text-destructive',      border: 'border-l-destructive' },
    { label: 'For Review',  value: metrics.pmNotResponding, color: 'text-purple-400',       border: 'border-l-purple-400' },
  ];

  const inspectionMetrics = [
    { label: 'Scheduled',  value: metrics.insScheduled, color: 'text-purple-400', border: 'border-l-purple-400' },
    { label: 'Pending PM', value: metrics.insPending,   color: 'text-blue-400',   border: 'border-l-blue-400' },
    { label: 'Responded',  value: metrics.insResponded, color: 'text-green-400',  border: 'border-l-green-400' },
  ];

  const hours = new Date().getHours();
  const timeOfDay = hours < 12 ? 'morning' : hours < 18 ? 'afternoon' : 'evening';
  const firstName = (user?.full_name ?? '').split(' ')[0] || 'there';

  if (isTechnician) return <Navigate to="/my-work" replace />;

  const formatRole = (r: string) => r.charAt(0).toUpperCase() + r.slice(1);
  const technicianOptions = technicianIds
    .map((id) => {
      const roles = userRoles[id] ?? [];
      const roleLabel = roles.length ? roles.map(formatRole).join(', ') : 'User';
      return { id, name: `${users[id] || 'Unnamed'} (${roleLabel})` };
    })
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
      {/* Greeting */}
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h1 className="text-base md:text-lg font-semibold text-foreground">Good {timeOfDay}, {firstName}</h1>
        <span className="text-[11px] md:text-xs text-muted-foreground">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {/* Tickets metrics */}
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tickets</h2>
        <div className="flex gap-2 overflow-x-auto md:overflow-visible md:grid md:grid-cols-6 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 pb-1">
          {ticketMetrics.map((m) => (
            <div key={m.label} className={`fs-card shrink-0 min-w-[110px] md:min-w-0 py-2.5 px-3 border-l-2 ${m.border} flex flex-col`}>
              <span className={`text-2xl font-bold leading-none ${m.color}`}>{m.value}</span>
              <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground mt-1.5">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Inspections metrics */}
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Inspections</h2>
        <div className="flex gap-2 overflow-x-auto md:overflow-visible md:grid md:grid-cols-3 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 pb-1">
          {inspectionMetrics.map((m) => (
            <div key={m.label} className={`fs-card shrink-0 min-w-[110px] md:min-w-0 py-2.5 px-3 border-l-2 ${m.border} flex flex-col`}>
              <span className={`text-2xl font-bold leading-none ${m.color}`}>{m.value}</span>
              <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground mt-1.5">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Search + filter chips */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 scrollbar-none">
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
            const property = ticket.property_id ? properties[ticket.property_id] : null;
            return (
              <button
                key={ticket.id}
                onClick={() => navigate(`/tickets/${ticket.id}`)}
                className={`w-full text-left fs-card border-l-[3px] ${leftBorder} py-2.5 px-3 hover:bg-secondary/30 transition-colors duration-150 space-y-0.5`}
              >
                {/* Line 1: identity + badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-foreground tracking-tight">{ticket.fs_number ?? 'No FS#'}</span>
                  <StatusPill className={colors.badge}>
                    {(ticket.work_type ?? 'repair').replace('-', ' ').toUpperCase()}
                  </StatusPill>
                  <StatusPill className={statusColors[ticket.status ?? 'draft']}>
                    {statusLabels[ticket.status ?? 'draft']}
                  </StatusPill>
                  {ticket.priority && ticket.priority !== 'normal' && (
                    <StatusPill
                      className={
                        ticket.priority === 'urgent'
                          ? 'bg-destructive text-destructive-foreground'
                          : ticket.priority === 'high'
                          ? 'bg-orange-500 text-white'
                          : 'bg-muted text-muted-foreground'
                      }
                    >
                      {ticket.priority.toUpperCase()}
                    </StatusPill>
                  )}
                </div>

                {/* Line 2: property + technician */}
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate min-w-0">
                    {property && <span className="font-semibold text-foreground">{property.name}</span>}
                    {ticket.unit && <span className="text-muted-foreground"> · Unit {ticket.unit}</span>}
                  </span>
                  <span className="text-xs shrink-0 truncate max-w-[40%]">
                    {ticket.technician_id
                      ? <span className="text-muted-foreground">{users[ticket.technician_id]}</span>
                      : <span className="text-destructive font-medium">Unassigned</span>}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>


      {/* Inspections section */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">
            Inspections <span className="text-muted-foreground font-normal">({inspections.length})</span>
          </h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/inspections')}>View all</Button>
        </div>
        {inspections.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No inspections yet"
            description="Scheduled inspections will appear here."
          />
        ) : (
          <div className="space-y-2">
            {inspections.slice(0, 10).map((ins) => {
              const property = ins.property_id ? properties[ins.property_id] : null;
              return (
                <button
                  key={ins.id}
                  onClick={() => navigate(`/inspections/${ins.id}`)}
                  className="w-full text-left fs-card border-l-[3px] border-l-amber-400 py-3 px-4 hover:bg-secondary/30 transition-colors duration-150 space-y-1"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-foreground tracking-tight">{ins.ins_number ?? 'No INS#'}</span>
                    <Badge className={`text-[10px] ${inspectionStatusColors[ins.status ?? 'draft']}`}>
                      {inspectionStatusLabels[ins.status ?? 'draft']}
                    </Badge>
                  </div>
                  {property && (
                    <p className="text-sm font-semibold text-foreground truncate">{property.name}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {ins.assigned_to ? users[ins.assigned_to] || 'Assigned' : <span className="text-destructive font-medium">Unassigned</span>}
                    </span>
                    {ins.visit_date && (
                      <span>
                        {new Date(ins.visit_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating quick-create FAB */}
      {canQuickCreate && (
        <button
          onClick={() => setQuickOpen(true)}
          aria-label="Quick create ticket"
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-xl z-30 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: '#FFD700', color: '#000' }}
        >
          <Plus className="w-7 h-7" strokeWidth={2.5} />
        </button>
      )}

      {/* Quick Create Modal */}
      <Dialog open={quickOpen} onOpenChange={(o) => { setQuickOpen(o); if (!o) resetQuickForm(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Quick Create Ticket</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Work Type</Label>
                <Select value={qcWorkType} onValueChange={setQcWorkType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="make_ready">Make-Ready</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                    <SelectItem value="capex">CapEx</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={qcPriority} onValueChange={setQcPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Property</Label>
              <Input
                placeholder="Search property by name or address..."
                value={propertySearch}
                onChange={(e) => setPropertySearch(e.target.value)}
                className="mb-2"
              />
              <Select value={qcPropertyId} onValueChange={setQcPropertyId}>
                <SelectTrigger><SelectValue placeholder="Select a property" /></SelectTrigger>
                <SelectContent>
                  {propertyOptionsList.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No matches</div>
                  )}
                  {propertyOptionsList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name || p.address}{p.name && p.address ? ` — ${p.address}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Unit</Label>
              <Input value={qcUnit} onChange={(e) => setQcUnit(e.target.value)} placeholder="Optional" />
            </div>

            <div>
              <Label>Technician</Label>
              <Select value={qcTechnicianId} onValueChange={setQcTechnicianId}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  {technicianOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea value={qcDescription} onChange={(e) => setQcDescription(e.target.value)} rows={3} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setQuickOpen(false); resetQuickForm(); }}>Cancel</Button>
            <Button onClick={handleQuickCreate} disabled={creating} style={{ backgroundColor: '#FFD700', color: '#000' }}>
              {creating ? 'Creating...' : 'Create Ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
