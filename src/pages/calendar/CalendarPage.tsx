import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calendar as BigCalendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

const localizer = momentLocalizer(moment);

const eventColor = (workType: string | null, status: string | null): string => {
  if (status === 'paused') return '#6b7280'; // gray
  switch (workType) {
    case 'make_ready': case 'make-ready': return '#f97316'; // orange
    case 'emergency': return '#ef4444'; // red
    case 'capex': return '#22c55e'; // green
    case 'repair': return '#eab308'; // gold
    default: return '#eab308';
  }
};

interface RescheduleState {
  ticketId: string;
  title: string;
  currentTime: string;
  newTime: string;
  isInProgressMakeReady: boolean;
}

const CalendarPage = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<any>(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [reschedule, setReschedule] = useState<RescheduleState | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: tickets = [] } = useQuery({
    queryKey: ['calendar-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('id, fs_number, work_type, status, appointment_time, technician_id, property_id, unit, properties(name, address), work_started_at')
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

  const userMap = useMemo(() => {
    const m: Record<string, string> = {};
    users.forEach((u: any) => { m[u.id] = u.full_name || 'Unknown'; });
    return m;
  }, [users]);

  const events = useMemo(() => {
    const ticketEvents = tickets.map((t: any) => {
      const start = new Date(t.appointment_time);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      const techName = t.technician_id ? userMap[t.technician_id] || 'Assigned' : 'Unassigned';
      const propName = (t.properties as any)?.name || (t.properties as any)?.address || '';
      return {
        id: `ticket-${t.id}`,
        ticketId: t.id,
        title: `${propName} • ${t.work_type} • ${techName}`,
        start,
        end,
        color: eventColor(t.work_type, t.status),
        type: 'ticket' as const,
        workType: t.work_type,
        status: t.status,
        techName,
        isUnassigned: !t.technician_id,
        isInProgressMakeReady: t.status === 'in_progress' && (t.work_type === 'make_ready' || t.work_type === 'make-ready') && !!t.work_started_at,
      };
    });

    const inspectionEvents = inspections.map((ins: any) => {
      const start = new Date(ins.visit_date + 'T09:00:00');
      const end = new Date(ins.visit_date + 'T11:00:00');
      const propName = (ins.properties as any)?.name || (ins.properties as any)?.address || '';
      return {
        id: `ins-${ins.id}`,
        ticketId: ins.id,
        title: `${ins.ins_number} • ${propName} • Inspection`,
        start,
        end,
        color: '#3b82f6', // blue
        type: 'inspection' as const,
        workType: 'inspection',
        status: ins.status,
        techName: '',
        isUnassigned: false,
        isInProgressMakeReady: false,
      };
    });

    return [...ticketEvents, ...inspectionEvents];
  }, [tickets, inspections, userMap]);

  const eventStyleGetter = useCallback((event: any) => ({
    style: {
      backgroundColor: event.color,
      borderRadius: '4px',
      color: '#fff',
      border: 'none',
      fontSize: '11px',
      padding: '2px 4px',
    },
  }), []);

  const handleSelectEvent = (event: any) => {
    if (event.type === 'inspection') {
      navigate(`/inspections/${event.ticketId}`);
    } else {
      navigate(`/tickets/${event.ticketId}`);
    }
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
  };

  const CustomEvent = ({ event }: { event: any }) => {
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    return (
      <div
        className="flex items-center gap-1 text-[11px] leading-tight cursor-pointer"
        onContextMenu={(e) => { e.preventDefault(); handleRescheduleClick(event, e); }}
        onTouchStart={() => { longPressTimer = setTimeout(() => handleRescheduleClick(event), 600); }}
        onTouchEnd={() => { if (longPressTimer) clearTimeout(longPressTimer); }}
        onTouchMove={() => { if (longPressTimer) clearTimeout(longPressTimer); }}
      >
        <span className="truncate flex-1">{event.title}</span>
        {event.isUnassigned && <span className="text-red-200 font-bold text-[9px]">!</span>}
      </div>
    );
  };

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-foreground">Calendar</h1>
        <div className="flex gap-1 flex-wrap">
          {/* Legend */}
          {[
            { label: 'Make-Ready', color: '#f97316' },
            { label: 'Emergency', color: '#ef4444' },
            { label: 'CapEx', color: '#22c55e' },
            { label: 'Repair', color: '#eab308' },
            { label: 'Inspection', color: '#3b82f6' },
            { label: 'Paused', color: '#6b7280' },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-2 calendar-container">
        <style>{`
          .rbc-calendar { color: hsl(var(--foreground)); }
          .rbc-toolbar button { color: hsl(var(--foreground)); background: hsl(var(--secondary)); border-color: hsl(var(--border)); font-size: 12px; }
          .rbc-toolbar button:hover { background: hsl(var(--accent)); }
          .rbc-toolbar button.rbc-active { background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); }
          .rbc-header { color: hsl(var(--muted-foreground)); font-size: 12px; border-color: hsl(var(--border)); }
          .rbc-month-view, .rbc-time-view { border-color: hsl(var(--border)); }
          .rbc-day-bg { background: hsl(var(--card)); }
          .rbc-today { background: hsl(var(--primary) / 0.08) !important; }
          .rbc-off-range-bg { background: hsl(var(--muted) / 0.3); }
          .rbc-date-cell { color: hsl(var(--foreground)); font-size: 12px; }
          .rbc-off-range { color: hsl(var(--muted-foreground)); }
          .rbc-month-row + .rbc-month-row { border-color: hsl(var(--border)); }
          .rbc-day-bg + .rbc-day-bg { border-color: hsl(var(--border)); }
          .rbc-time-content, .rbc-time-header-content { border-color: hsl(var(--border)); }
          .rbc-timeslot-group { border-color: hsl(var(--border)); }
          .rbc-time-slot { color: hsl(var(--muted-foreground)); font-size: 11px; }
          .rbc-current-time-indicator { background: hsl(var(--primary)); }
          .rbc-event { cursor: pointer; }
          .rbc-show-more { color: hsl(var(--primary)); font-size: 11px; }
        `}</style>
        <BigCalendar
          localizer={localizer}
          events={events}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={handleSelectEvent}
          components={{ event: CustomEvent }}
          style={{ height: 'min(650px, calc(100vh - 200px))' }}
          popup
        />
      </div>

      <p className="text-[10px] text-muted-foreground hidden sm:block">Right-click an event to reschedule</p>
      <p className="text-[10px] text-muted-foreground sm:hidden">Long-press an event to reschedule</p>

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
