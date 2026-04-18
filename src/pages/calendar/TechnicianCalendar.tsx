import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar as BigCalendar, momentLocalizer, Views, ToolbarProps } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';

const localizer = momentLocalizer(moment);

const eventColor = (workType: string | null, status: string | null): string => {
  if (status === 'paused') return '#6b7280';
  switch (workType) {
    case 'make_ready':
    case 'make-ready':
      return '#f97316';
    case 'emergency':
      return '#ef4444';
    case 'capex':
      return '#22c55e';
    case 'repair':
      return '#eab308';
    default:
      return '#eab308';
  }
};

const CustomToolbar = ({ label, onNavigate, onView, view }: ToolbarProps) => (
  <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
    <div className="flex items-center gap-1">
      <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => onNavigate('PREV')}>
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <Button variant="default" size="sm" className="h-8 px-3 text-xs font-semibold" onClick={() => onNavigate('TODAY')}>
        <CalendarDays className="w-3.5 h-3.5 mr-1" />Today
      </Button>
      <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => onNavigate('NEXT')}>
        <ChevronRight className="w-4 h-4" />
      </Button>
      <span className="text-sm font-bold text-foreground ml-2">{label}</span>
    </div>
    <div className="flex gap-1 bg-secondary rounded-md p-0.5">
      {(['week', 'day'] as const).map(v => (
        <button
          key={v}
          onClick={() => onView(v)}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors capitalize ${view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {v}
        </button>
      ))}
    </div>
  </div>
);

const TechnicianCalendar = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [view, setView] = useState<any>(Views.WEEK);
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('my-calendar-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        queryClient.invalidateQueries({ queryKey: ['my-calendar-tickets', user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, user?.id]);

  const { data: tickets = [] } = useQuery({
    queryKey: ['my-calendar-tickets', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('tickets')
        .select('id, fs_number, work_type, status, appointment_time, property_id, unit, properties(name, address)')
        .eq('technician_id', user.id)
        .not('appointment_time', 'is', null)
        .order('appointment_time');
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const events = useMemo(() => {
    return tickets.map((t: any) => {
      const start = new Date(t.appointment_time);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      const propName = (t.properties as any)?.name || (t.properties as any)?.address || '';
      return {
        id: t.id,
        ticketId: t.id,
        title: propName,
        start,
        end,
        color: eventColor(t.work_type, t.status),
        workType: t.work_type,
        status: t.status,
        propName,
        fsNumber: t.fs_number,
        unit: t.unit,
      };
    });
  }, [tickets]);

  const eventStyleGetter = useCallback(() => ({
    style: { backgroundColor: 'transparent', border: 'none', padding: 0, margin: 0 },
  }), []);

  const handleSelectEvent = (event: any) => {
    navigate(`/tickets/${event.ticketId}/work`);
  };

  const CustomEvent = ({ event }: { event: any }) => (
    <div
      className="rounded px-1.5 py-0.5 text-white cursor-pointer overflow-hidden"
      style={{ backgroundColor: event.color, borderLeft: `3px solid ${event.color}`, filter: 'brightness(1.05)' }}
    >
      <div className="text-[11px] leading-tight space-y-0.5">
        <div className="font-semibold truncate">{event.fsNumber}</div>
        <div className="opacity-90 truncate">{event.propName}{event.unit ? ` · ${event.unit}` : ''}</div>
        <div className="opacity-70 text-[10px]">{format(event.start, 'h:mm a')}</div>
      </div>
    </div>
  );

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-3">
      <h1 className="text-xl font-bold text-foreground">My Calendar</h1>

      <div className="rounded-lg border border-border bg-card p-2">
        <style>{`
          .rbc-calendar { color: hsl(var(--foreground)); }
          .rbc-toolbar { display: none; }
          .rbc-header { color: hsl(var(--muted-foreground)); font-size: 12px; border-color: hsl(var(--border)); }
          .rbc-time-view { border-color: hsl(var(--border)); }
          .rbc-day-bg { background: hsl(var(--card)); }
          .rbc-today { background: hsl(var(--primary) / 0.12) !important; }
          .rbc-time-content, .rbc-time-header-content { border-color: hsl(var(--border)); }
          .rbc-timeslot-group { border-color: hsl(var(--border)); }
          .rbc-time-slot { color: hsl(var(--muted-foreground)); font-size: 11px; }
          .rbc-current-time-indicator { background: hsl(var(--primary)); height: 2px; }
          .rbc-event { cursor: pointer; background: transparent !important; border: none !important; padding: 0 !important; }
          .rbc-event-label { display: none; }
        `}</style>
        <CustomToolbar
          label={moment(date).format(view === Views.DAY ? 'dddd, MMMM D, YYYY' : `MMM D – ${moment(date).endOf('week').format('D, YYYY')}`)}
          onNavigate={(action: any) => {
            if (action === 'TODAY') setDate(new Date());
            else if (action === 'PREV') setDate(moment(date).subtract(1, view === Views.WEEK ? 'week' : 'day').toDate());
            else if (action === 'NEXT') setDate(moment(date).add(1, view === Views.WEEK ? 'week' : 'day').toDate());
          }}
          onView={(v: any) => setView(v)}
          view={view}
          views={['week', 'day'] as any}
          date={date}
          localizer={localizer as any}
        />
        <BigCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          view={view}
          onView={setView as any}
          date={date}
          onNavigate={setDate}
          views={[Views.WEEK, Views.DAY]}
          eventPropGetter={eventStyleGetter}
          components={{ event: CustomEvent }}
          onSelectEvent={handleSelectEvent}
          style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}
        />
      </div>
    </div>
  );
};

export default TechnicianCalendar;
