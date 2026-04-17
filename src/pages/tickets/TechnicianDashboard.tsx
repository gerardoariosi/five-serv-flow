import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { workTypeColors, statusLabels, statusColors } from '@/lib/ticketColors';
import Spinner from '@/components/ui/Spinner';
import { CalendarDays, Clock, History, CheckCircle2, Loader2, FileSearch } from 'lucide-react';
import { startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';

const TechnicianDashboard = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Record<string, { name: string; address: string }>>({});

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [tRes, pRes] = await Promise.all([
      supabase.from('tickets').select('*').eq('technician_id', user.id).order('appointment_time', { ascending: true }),
      supabase.from('properties').select('id, name, address'),
    ]);
    setTickets(tRes.data ?? []);
    const pMap: Record<string, { name: string; address: string }> = {};
    (pRes.data ?? []).forEach((p: any) => { pMap[p.id] = { name: p.name ?? '', address: p.address ?? '' }; });
    setProperties(pMap);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();

    // Realtime: refetch when any of this technician's tickets change
    const channel = supabase
      .channel('my-tickets-realtime')
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

  const todayET = useMemo(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  }, []);

  const todayTickets = useMemo(() => {
    return tickets.filter(t => {
      if (!t.appointment_time) return false;
      const apptDate = new Date(t.appointment_time).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      return apptDate === todayET && !['closed', 'cancelled'].includes(t.status ?? '');
    });
  }, [tickets, todayET]);

  const upcomingTickets = useMemo(() => {
    return tickets.filter(t => {
      if (!t.appointment_time) return false;
      const apptDate = new Date(t.appointment_time).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      return apptDate > todayET && !['closed', 'cancelled'].includes(t.status ?? '');
    });
  }, [tickets, todayET]);

  const historyTickets = useMemo(() => {
    return tickets.filter(t => ['closed', 'cancelled'].includes(t.status ?? ''));
  }, [tickets]);

  // Quick Stats
  const stats = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const completedThisWeek = tickets.filter(t => {
      if (t.status !== 'closed') return false;
      if (!t.closed_at) return false;
      try {
        return isWithinInterval(new Date(t.closed_at), { start: weekStart, end: weekEnd });
      } catch { return false; }
    }).length;

    const inProgress = tickets.filter(t => t.status === 'in_progress').length;
    const pendingReview = tickets.filter(t => t.status === 'pending_review' || t.status === 'awaiting_review').length;

    return { completedThisWeek, inProgress, pendingReview };
  }, [tickets]);

  const TicketCard = ({ ticket }: { ticket: any }) => {
    const colors = workTypeColors[ticket.work_type ?? 'repair'] ?? workTypeColors.repair;
    const isEmergency = ticket.work_type === 'emergency';
    const prop = ticket.property_id ? properties[ticket.property_id] : null;
    return (
      <button
        onClick={() => navigate(`/tickets/${ticket.id}`)}
        className={`w-full text-left p-4 rounded-lg border ${isEmergency ? 'border-destructive bg-destructive/10' : colors.border + ' ' + colors.bg} transition-colors hover:opacity-90`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-foreground">{ticket.fs_number ?? 'No FS#'}</span>
              <Badge className={`text-[10px] ${colors.badge}`}>{(ticket.work_type ?? 'repair').replace(/[-_]/g, ' ').toUpperCase()}</Badge>
              <Badge className={`text-[10px] ${statusColors[ticket.status ?? 'draft']}`}>{statusLabels[ticket.status ?? 'draft']}</Badge>
            </div>
            {prop && (
              <p className="text-sm text-foreground mt-1 truncate font-medium">
                {prop.name}{ticket.unit ? ` · Unit ${ticket.unit}` : ''}
              </p>
            )}
            {prop?.address && (
              <p className="text-xs text-muted-foreground truncate">{prop.address}</p>
            )}
            {ticket.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ticket.description}</p>
            )}
          </div>
          {ticket.appointment_time && (
            <div className="text-right shrink-0">
              <p className="text-xs text-primary font-medium whitespace-nowrap">
                {new Date(ticket.appointment_time).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          )}
        </div>
      </button>
    );
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-foreground">My Work</h1>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-card border border-border rounded-lg p-3 flex flex-col items-center text-center">
          <CheckCircle2 className="w-5 h-5 text-green-500 mb-1" />
          <span className="text-xl font-bold text-foreground">{stats.completedThisWeek}</span>
          <span className="text-[10px] text-muted-foreground leading-tight">Completed this week</span>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 flex flex-col items-center text-center">
          <Loader2 className="w-5 h-5 text-primary mb-1" />
          <span className="text-xl font-bold text-foreground">{stats.inProgress}</span>
          <span className="text-[10px] text-muted-foreground leading-tight">In progress</span>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 flex flex-col items-center text-center">
          <FileSearch className="w-5 h-5 text-yellow-500 mb-1" />
          <span className="text-xl font-bold text-foreground">{stats.pendingReview}</span>
          <span className="text-[10px] text-muted-foreground leading-tight">Pending review</span>
        </div>
      </div>

      <Tabs defaultValue="today">
        <TabsList className="w-full">
          <TabsTrigger value="today" className="flex-1"><CalendarDays className="w-4 h-4 mr-1" /> Today</TabsTrigger>
          <TabsTrigger value="upcoming" className="flex-1"><Clock className="w-4 h-4 mr-1" /> Upcoming</TabsTrigger>
          <TabsTrigger value="history" className="flex-1"><History className="w-4 h-4 mr-1" /> History</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-2 mt-4">
          {todayTickets.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No work assigned for today</p>
            </div>
          ) : (
            todayTickets.map(t => <TicketCard key={t.id} ticket={t} />)
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-2 mt-4">
          {upcomingTickets.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No upcoming tickets</p>
          ) : (
            upcomingTickets.map(t => <TicketCard key={t.id} ticket={t} />)
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-2 mt-4">
          {historyTickets.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No completed tickets</p>
          ) : (
            historyTickets.map(t => <TicketCard key={t.id} ticket={t} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TechnicianDashboard;
