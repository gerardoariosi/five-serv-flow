import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, Plus, MoreVertical, Trash2, Ticket as TicketIcon } from 'lucide-react';
import { workTypeColors, statusLabels, statusColors } from '@/lib/ticketColors';
import SkeletonCard from '@/components/ui/SkeletonCard';
import EmptyState from '@/components/ui/EmptyState';
import { toast } from 'sonner';

const workTypeBorder: Record<string, string> = {
  emergency: 'border-l-[#ef4444]',
  'make-ready': 'border-l-[#f97316]',
  make_ready: 'border-l-[#f97316]',
  repair: 'border-l-[#3b82f6]',
  capex: 'border-l-[#22c55e]',
};

const STATUS_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'paused', label: 'Paused' },
  { key: 'ready_for_review', label: 'For Review' },
  { key: 'pending_evaluation', label: 'Pending Eval' },
  { key: 'estimate_sent', label: 'Estimate Sent' },
  { key: 'closed', label: 'Closed' },
];

const TYPE_CHIPS = [
  { key: 'all', label: 'All Types' },
  { key: 'make-ready', label: 'Make-Ready' },
  { key: 'emergency', label: 'Emergency' },
  { key: 'repair', label: 'Repair' },
  { key: 'capex', label: 'CapEx' },
];

const TicketList = () => {
  const { activeRole } = useAuthStore();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);

  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterZone, setFilterZone] = useState('all');
  const [clients, setClients] = useState<Record<string, string>>({});
  const [properties, setProperties] = useState<Record<string, { name: string; address: string }>>({});
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const fetchData = useCallback(async () => {
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

  useEffect(() => {
    const handler = () => searchRef.current?.focus();
    window.addEventListener('focus-search', handler);
    return () => window.removeEventListener('focus-search', handler);
  }, []);

  const filtered = useMemo(() => {
    let result = tickets;
    if (activeRole === 'accounting') result = result.filter((t: any) => t.status !== 'draft');
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
    return [...result].sort((a: any, b: any) => {
      if (a.work_type === 'emergency' && b.work_type !== 'emergency') return -1;
      if (b.work_type === 'emergency' && a.work_type !== 'emergency') return 1;
      return 0;
    });
  }, [tickets, search, filterStatus, filterType, filterZone, activeRole, clients, properties, users]);

  const handleDeleteTicket = async (ticket: any) => {
    await supabase.from('ticket_photos').delete().eq('ticket_id', ticket.id);
    await supabase.from('ticket_timeline').delete().eq('ticket_id', ticket.id);
    await supabase.from('tickets').delete().eq('id', ticket.id);
    toast.success('Ticket deleted');
    setDeleteTarget(null);
    fetchData();
  };

  return (
    <div className="flex flex-col h-full">
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Permanently Delete Ticket?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone. The ticket, all photos, and timeline entries will be permanently removed.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && handleDeleteTicket(deleteTarget)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fixed search + filter bar at top of page area */}
      <div className="px-4 pt-4 pb-3 bg-background/95 backdrop-blur-sm space-y-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-bold text-foreground">Tickets</h1>
            <span className="text-sm font-medium text-muted-foreground">({filtered.length})</span>
          </div>
          {(activeRole === 'admin' || activeRole === 'supervisor') && (
            <Button size="sm" onClick={() => navigate('/tickets/new')}>
              <Plus className="w-4 h-4 mr-1" /> New Ticket
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input ref={searchRef} placeholder="Search tickets…" value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>

        {/* Chip filter rows */}
        <div className="space-y-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {STATUS_CHIPS.map(c => {
              const active = filterStatus === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setFilterStatus(c.key)}
                  className={`shrink-0 px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all active:scale-95 ${
                    active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {TYPE_CHIPS.map(c => {
              const active = filterType === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setFilterType(c.key)}
                  className={`shrink-0 px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all active:scale-95 ${
                    active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
            {zones.length > 0 && (
              <>
                <button
                  onClick={() => setFilterZone('all')}
                  className={`shrink-0 px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all active:scale-95 ${
                    filterZone === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  All Zones
                </button>
                {zones.map(z => {
                  const active = filterZone === z.id;
                  return (
                    <button
                      key={z.id}
                      onClick={() => setFilterZone(z.id)}
                      className={`shrink-0 px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all active:scale-95 ${
                        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'
                      }`}
                    >
                      {z.name}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <SkeletonCard count={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={TicketIcon}
            title="No tickets found"
            description="Try clearing filters or create a new ticket."
            actionLabel={(activeRole === 'admin' || activeRole === 'supervisor') ? 'New Ticket' : undefined}
            onAction={() => navigate('/tickets/new')}
          />
        ) : (
          filtered.map((ticket: any) => {
            const colors = workTypeColors[ticket.work_type ?? 'repair'] ?? workTypeColors.repair;
            const leftBorder = workTypeBorder[ticket.work_type ?? 'repair'] ?? 'border-l-muted-foreground';
            return (
              <div key={ticket.id} className="flex items-start gap-1">
                <button
                  onClick={() => navigate(`/tickets/${ticket.id}`)}
                  className={`flex-1 text-left fs-card border-l-4 ${leftBorder} p-3.5 active:scale-[0.99] transition-transform duration-100`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-foreground">{ticket.fs_number ?? 'No FS#'}</span>
                        <Badge className={`text-[10px] ring-1 ring-current/20 ${colors.badge}`}>{(ticket.work_type ?? 'repair').replace('-', ' ').toUpperCase()}</Badge>
                        <Badge className={`text-[10px] ring-1 ring-current/20 ${statusColors[ticket.status ?? 'draft']}`}>{statusLabels[ticket.status ?? 'draft']}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1.5 truncate">
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
                {activeRole === 'admin' && (ticket.status === 'draft' || ticket.status === 'cancelled') && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0 mt-1">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(ticket); }}>
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TicketList;
