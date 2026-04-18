import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar as BigCalendar, momentLocalizer, Views, ToolbarProps } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';

const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(BigCalendar as any);

const eventColor = (workType: string | null, status: string | null): string => {
  if (status === 'paused') return '#6b7280';
  switch (workType) {
    case 'make_ready': case 'make-ready': return '#f97316';
    case 'emergency': return '#ef4444';
    case 'capex': return '#22c55e';
    case 'repair': return '#eab308';
    case 'inspection': return '#3b82f6';
    default: return '#eab308';
  }
};

interface CalendarEvent {
  id: string;
  ticketId: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
  type: 'ticket' | 'inspection';
  workType: string | null;
  status: string | null;
  techName: string;
  propName: string;
  isUnassigned: boolean;
  isInProgressMakeReady: boolean;
}

interface RescheduleState {
  ticketId: string;
  title: string;
  currentTime: string;
  newTime: string;
  isInProgressMakeReady: boolean;
}

// ─── Custom Toolbar ───
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
      {(['month', 'week', 'day'] as const).map(v => (
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

// ─── Legend ───
const legendItems = [
  { label: 'Make-Ready', color: '#f97316' },
  { label: 'Emergency', color: '#ef4444' },
  { label: 'CapEx', color: '#22c55e' },
  { label: 'Repair/Regular', color: '#eab308' },
  { label: 'Inspection', color: '#3b82f6' },
  { label: 'Paused', color: '#6b7280' },
];

const CalendarPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [view, setView] = useState<any>(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [reschedule, setReschedule] = useState<RescheduleState | null>(null);
  const [saving, setSaving] = useState(false);
  const [createDialog, setCreateDialog] = useState<{ open: boolean; date: Date | null }>({ open: false, date: null });

  // Filters
  const [filterTech, setFilterTech] = useState<string>('all');
  const [filterZone, setFilterZone] = useState<string>('all');
  const [filterWorkType, setFilterWorkType] = useState<string>('all');

  const { data: tickets = [] } = useQuery({
    queryKey: ['calendar-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('id, fs_number, work_type, status, appointment_time, technician_id, property_id, unit, zone_id, properties(name, address), work_started_at')
        .neq('status', 'draft')
        .not('appointment_time', 'is', null)
        .order('appointment_time');
      if (error) throw error;
      return data;
    },
  });

  const { data: inspections = [] } = useQuery({
    queryKey: ['calendar-inspections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspections')
        .select('id, ins_number, visit_date, status, property_id, properties(name, address)')
        .in('status', ['draft', 'inspecting', 'pricing', 'sent'])
        .not('visit_date', 'is', null);
      if (error) throw error;
      return data;
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ['calendar-users'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_user_directory');
      return data || [];
    },
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['calendar-zones'],
    queryFn: async () => {
      const { data } = await supabase.from('zones').select('id, name').order('name');
      return data || [];
    },
  });

  const { data: workTypes = [] } = useQuery({
    queryKey: ['work_types'],
    queryFn: async () => {
      const { data } = await supabase.from('work_types').select('key, label').order('label');
      return data || [];
    },
  });

  const userMap = useMemo(() => {
    const m: Record<string, string> = {};
    users.forEach((u: any) => { m[u.id] = u.full_name || 'Unknown'; });
    return m;
  }, [users]);

  const events: CalendarEvent[] = useMemo(() => {
    const ticketEvents: CalendarEvent[] = tickets.map((t: any) => {
      const start = new Date(t.appointment_time);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      const techName = t.technician_id ? userMap[t.technician_id] || 'Assigned' : 'Unassigned';
      const propName = (t.properties as any)?.name || (t.properties as any)?.address || '';
      return {
        id: `ticket-${t.id}`,
        ticketId: t.id,
        title: propName,
        start,
        end,
        color: eventColor(t.work_type, t.status),
        type: 'ticket' as const,
        workType: t.work_type,
        status: t.status,
        techName,
        propName,
        isUnassigned: !t.technician_id,
        isInProgressMakeReady: t.status === 'in_progress' && (t.work_type === 'make_ready' || t.work_type === 'make-ready') && !!t.work_started_at,
        _raw: t,
      };
    });

    const inspectionEvents: CalendarEvent[] = inspections.map((ins: any) => {
      const start = new Date(ins.visit_date + 'T09:00:00');
      const end = new Date(ins.visit_date + 'T11:00:00');
      const propName = (ins.properties as any)?.name || (ins.properties as any)?.address || '';
      return {
        id: `ins-${ins.id}`,
        ticketId: ins.id,
        title: `${ins.ins_number} • ${propName}`,
        start,
        end,
        color: '#3b82f6',
        type: 'inspection' as const,
        workType: 'inspection',
        status: ins.status,
        techName: '',
        propName,
        isUnassigned: false,
        isInProgressMakeReady: false,
      };
    });

    let all = [...ticketEvents, ...inspectionEvents];

    // Apply filters
    if (filterTech !== 'all') {
      all = all.filter(e => {
        if (e.type === 'inspection') return true;
        const t = tickets.find((tk: any) => `ticket-${tk.id}` === e.id);
        return t?.technician_id === filterTech;
      });
    }
    if (filterZone !== 'all') {
      all = all.filter(e => {
        if (e.type === 'inspection') return true;
        const t = tickets.find((tk: any) => `ticket-${tk.id}` === e.id);
        return t?.zone_id === filterZone;
      });
    }
    if (filterWorkType !== 'all') {
      all = all.filter(e => e.workType === filterWorkType);
    }

    return all;
  }, [tickets, inspections, userMap, filterTech, filterZone, filterWorkType]);

  // Technician workload for visible range
  const techWorkload = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach(e => {
      if (e.type === 'ticket' && e.techName && e.techName !== 'Unassigned') {
        counts[e.techName] = (counts[e.techName] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [events]);

  const eventStyleGetter = useCallback((event: any) => ({
    style: {
      backgroundColor: 'transparent',
      border: 'none',
      padding: 0,
      margin: 0,
    },
  }), []);

  const handleSelectEvent = (event: any) => {
    if (event.type === 'inspection') {
      navigate(`/inspections/${event.ticketId}`);
    } else {
      navigate(`/tickets/${event.ticketId}`);
    }
  };

  const handleSelectSlot = (slotInfo: any) => {
    setCreateDialog({ open: true, date: slotInfo.start });
  };

  const handleEventDrop = async ({ event, start }: any) => {
    if (event.type !== 'ticket') return;
    setSaving(true);
    const { error } = await supabase
      .from('tickets')
      .update({ appointment_time: new Date(start).toISOString() })
      .eq('id', event.ticketId);
    setSaving(false);
    if (error) { toast.error('Failed to reschedule'); return; }
    toast.success('Appointment rescheduled');
    queryClient.invalidateQueries({ queryKey: ['calendar-tickets'] });
  };

  const handleRescheduleClick = (event: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (event.type !== 'ticket') return;
    const ticket = tickets.find((t: any) => t.id === event.ticketId);
    if (!ticket) return;
    setReschedule({
      ticketId: ticket.id,
      title: event.title,
      currentTime: ticket.appointment_time,
      newTime: ticket.appointment_time?.slice(0, 16) || '',
      isInProgressMakeReady: event.isInProgressMakeReady,
    });
  };

  const handleSaveReschedule = async () => {
    if (!reschedule) return;
    setSaving(true);
    const { error } = await supabase
      .from('tickets')
      .update({ appointment_time: new Date(reschedule.newTime).toISOString() })
      .eq('id', reschedule.ticketId);
    setSaving(false);
    if (error) { toast.error('Failed to reschedule'); return; }
    toast.success('Appointment rescheduled');
    setReschedule(null);
    queryClient.invalidateQueries({ queryKey: ['calendar-tickets'] });
  };

  // ─── Custom Event Component ───
  const CustomEvent = ({ event }: { event: any }) => {
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    const isCompact = view === Views.MONTH;
    return (
      <div
        className="rounded px-1.5 py-0.5 text-white cursor-pointer overflow-hidden"
        style={{ backgroundColor: event.color, borderLeft: `3px solid ${event.color}`, filter: 'brightness(1.05)' }}
        onContextMenu={(e) => { e.preventDefault(); handleRescheduleClick(event, e); }}
        onTouchStart={() => { longPressTimer = setTimeout(() => handleRescheduleClick(event), 600); }}
        onTouchEnd={() => { if (longPressTimer) clearTimeout(longPressTimer); }}
        onTouchMove={() => { if (longPressTimer) clearTimeout(longPressTimer); }}
      >
        {isCompact ? (
          <div className="flex items-center gap-1 text-[10px] leading-tight">
            <span className="truncate flex-1 font-medium">{event.propName || event.title}</span>
            {event.isUnassigned && <span className="text-red-200 font-bold">!</span>}
          </div>
        ) : (
          <div className="text-[11px] leading-tight space-y-0.5">
            <div className="font-semibold truncate">{event.propName || event.title}</div>
            {event.techName && <div className="opacity-80 truncate">{event.techName}</div>}
            <div className="opacity-70 text-[10px]">{format(event.start, 'h:mm a')}</div>
          </div>
        )}
      </div>
    );
  };

  const CalendarComponent = isMobile ? BigCalendar : DnDCalendar;

  const techOptions = useMemo(() => {
    const techIds = [...new Set(tickets.map((t: any) => t.technician_id).filter(Boolean))];
    return techIds.map(id => ({ id, name: userMap[id] || 'Unknown' }));
  }, [tickets, userMap]);

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Calendar</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <Select value={filterTech} onValueChange={setFilterTech}>
          <SelectTrigger className="w-[150px] h-8 text-xs bg-secondary border-border"><SelectValue placeholder="Technician" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Technicians</SelectItem>
            {techOptions.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterZone} onValueChange={setFilterZone}>
          <SelectTrigger className="w-[130px] h-8 text-xs bg-secondary border-border"><SelectValue placeholder="Zone" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Zones</SelectItem>
            {zones.map((z: any) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterWorkType} onValueChange={setFilterWorkType}>
          <SelectTrigger className="w-[140px] h-8 text-xs bg-secondary border-border"><SelectValue placeholder="Work Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {workTypes.map((w: any) => <SelectItem key={w.key} value={w.key}>{w.label}</SelectItem>)}
            <SelectItem value="inspection">Inspection</SelectItem>
          </SelectContent>
        </Select>

        {/* Legend */}
        <div className="flex gap-2 flex-wrap ml-auto">
          {legendItems.map((l) => (
            <div key={l.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* Workload summary */}
      {techWorkload.length > 0 && (
        <div className="flex gap-3 flex-wrap text-[11px]">
          <span className="text-muted-foreground font-medium">Workload:</span>
          {techWorkload.map(([name, count]) => (
            <span key={name} className="text-foreground">
              {name}: <span className="font-bold text-primary">{count}</span>
            </span>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-2 calendar-container">
        <style>{`
          .rbc-calendar { color: hsl(var(--foreground)); }
          .rbc-toolbar { display: none; }
          .rbc-header { color: hsl(var(--muted-foreground)); font-size: 12px; border-color: hsl(var(--border)); }
          .rbc-month-view, .rbc-time-view { border-color: hsl(var(--border)); }
          .rbc-day-bg { background: hsl(var(--card)); }
          .rbc-today { background: hsl(var(--primary) / 0.12) !important; }
          .rbc-off-range-bg { background: hsl(var(--muted) / 0.3); }
          .rbc-date-cell { color: hsl(var(--foreground)); font-size: 12px; }
          .rbc-date-cell.rbc-now { font-weight: bold; }
          .rbc-date-cell.rbc-now a { background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); border-radius: 50%; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; }
          .rbc-off-range { color: hsl(var(--muted-foreground)); }
          .rbc-month-row + .rbc-month-row { border-color: hsl(var(--border)); }
          .rbc-day-bg + .rbc-day-bg { border-color: hsl(var(--border)); }
          .rbc-time-content, .rbc-time-header-content { border-color: hsl(var(--border)); }
          .rbc-timeslot-group { border-color: hsl(var(--border)); }
          .rbc-time-slot { color: hsl(var(--muted-foreground)); font-size: 11px; }
          .rbc-current-time-indicator { background: hsl(var(--primary)); height: 2px; }
          .rbc-event { cursor: pointer; background: transparent !important; border: none !important; padding: 0 !important; }
          .rbc-event-label { display: none; }
          .rbc-show-more { color: hsl(var(--primary)); font-size: 11px; }
          .rbc-addons-dnd .rbc-addons-dnd-resize-ns-icon { display: none; }
          .rbc-addons-dnd-dragged-event { opacity: 0.5; }
          .rbc-slot-selection { background: hsl(var(--primary) / 0.15); }
        `}</style>
        <CustomToolbar
          label={moment(date).format(view === Views.DAY ? 'dddd, MMMM D, YYYY' : view === Views.WEEK ? `MMM D – ${moment(date).endOf('week').format('D, YYYY')}` : 'MMMM YYYY')}
          onNavigate={(action: any) => {
            if (action === 'TODAY') setDate(new Date());
            else if (action === 'PREV') setDate(moment(date).subtract(1, view === Views.MONTH ? 'month' : view === Views.WEEK ? 'week' : 'day').toDate());
            else if (action === 'NEXT') setDate(moment(date).add(1, view === Views.MONTH ? 'month' : view === Views.WEEK ? 'week' : 'day').toDate());
          }}
          onView={(v: any) => setView(v)}
          view={view}
          date={date}
          localizer={localizer}
          views={[Views.MONTH, Views.WEEK, Views.DAY] as any}
        />
        <CalendarComponent
          localizer={localizer}
          events={events}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          {...(!isMobile ? { onEventDrop: handleEventDrop, resizable: false } : {})}
          components={{ event: CustomEvent, toolbar: () => null }}
          style={{ height: 'min(650px, calc(100vh - 280px))' }}
          popup
        />
      </div>

      <p className="text-[10px] text-muted-foreground hidden sm:block">Right-click an event to reschedule • Drag to move (desktop) • Click empty day to create</p>
      <p className="text-[10px] text-muted-foreground sm:hidden">Long-press to reschedule • Tap empty day to create</p>

      {/* Create Dialog */}
      <Dialog open={createDialog.open} onOpenChange={o => setCreateDialog({ open: o, date: o ? createDialog.date : null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {createDialog.date && `Date: ${format(createDialog.date, 'MMMM d, yyyy')}`}
          </p>
          <div className="flex flex-col gap-2">
            <Button
              className="justify-start h-12"
              variant="outline"
              onClick={() => {
                setCreateDialog({ open: false, date: null });
                navigate(`/tickets/new${createDialog.date ? `?date=${format(createDialog.date, 'yyyy-MM-dd')}` : ''}`);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />Create Ticket
            </Button>
            <Button
              className="justify-start h-12"
              variant="outline"
              onClick={() => {
                setCreateDialog({ open: false, date: null });
                navigate(`/inspections/new${createDialog.date ? `?date=${format(createDialog.date, 'yyyy-MM-dd')}` : ''}`);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />Create Inspection
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={!!reschedule} onOpenChange={() => setReschedule(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reschedule Appointment</DialogTitle></DialogHeader>
          {reschedule && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{reschedule.title}</p>
              {reschedule.isInProgressMakeReady && (
                <div className="rounded-md bg-primary/10 border border-primary/30 p-3 text-sm text-primary">
                  ⚠️ Countdown is running and won't be affected by rescheduling.
                </div>
              )}
              <div>
                <Label>New Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={reschedule.newTime}
                  onChange={(e) => setReschedule({ ...reschedule, newTime: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReschedule(null)}>Cancel</Button>
            <Button onClick={handleSaveReschedule} disabled={saving}>
              {saving ? 'Saving...' : 'Reschedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;
