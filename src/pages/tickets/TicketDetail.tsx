import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft, Edit, Clock, Camera, MessageSquare } from 'lucide-react';
import { workTypeColors, statusLabels, statusColors } from '@/lib/ticketColors';
import { getBusinessDaysElapsed, getCountdownDaysRemaining, getCountdownColor } from '@/lib/businessDays';
import Spinner from '@/components/ui/Spinner';

const statusTransitions: Record<string, { next: string[]; roles: string[] }> = {
  draft: { next: ['open', 'cancelled'], roles: ['admin', 'supervisor'] },
  open: { next: ['in_progress', 'cancelled'], roles: ['admin', 'supervisor', 'technician'] },
  in_progress: { next: ['paused', 'ready_for_review', 'cancelled'], roles: ['admin', 'supervisor', 'technician'] },
  paused: { next: ['in_progress', 'cancelled'], roles: ['admin', 'supervisor', 'technician'] },
  ready_for_review: { next: ['closed', 'rejected'], roles: ['admin', 'supervisor'] },
  rejected: { next: ['in_progress'], roles: ['admin', 'supervisor', 'technician'] },
  closed: { next: ['open'], roles: ['admin'] },
  cancelled: { next: ['open'], roles: ['admin', 'supervisor'] },
};

const TicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeRole, user } = useAuthStore();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [changingStatus, setChangingStatus] = useState(false);

  // Lookup maps
  const [clients, setClients] = useState<Record<string, string>>({});
  const [properties, setProperties] = useState<Record<string, { name: string; address: string }>>({});
  const [zones, setZones] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<Record<string, string>>({});

  const fetchTicket = useCallback(async () => {
    if (!id) return;
    const [tRes, tlRes, phRes, cRes, pRes, zRes, uRes] = await Promise.all([
      supabase.from('tickets').select('*').eq('id', id).single(),
      supabase.from('ticket_timeline').select('*').eq('ticket_id', id).order('created_at', { ascending: false }),
      supabase.from('ticket_photos').select('*').eq('ticket_id', id).order('uploaded_at', { ascending: false }),
      supabase.from('clients').select('id, company_name'),
      supabase.from('properties').select('id, name, address'),
      supabase.from('zones').select('id, name'),
      supabase.from('users').select('id, full_name'),
    ]);

    setTicket(tRes.data);
    setTimeline(tlRes.data ?? []);
    setPhotos(phRes.data ?? []);

    const cMap: Record<string, string> = {};
    (cRes.data ?? []).forEach((c: any) => { cMap[c.id] = c.company_name ?? ''; });
    setClients(cMap);
    const pMap: Record<string, { name: string; address: string }> = {};
    (pRes.data ?? []).forEach((p: any) => { pMap[p.id] = { name: p.name ?? '', address: p.address ?? '' }; });
    setProperties(pMap);
    const zMap: Record<string, string> = {};
    (zRes.data ?? []).forEach((z: any) => { zMap[z.id] = z.name ?? ''; });
    setZones(zMap);
    const uMap: Record<string, string> = {};
    (uRes.data ?? []).forEach((u: any) => { uMap[u.id] = u.full_name ?? ''; });
    setUsers(uMap);

    // Calculate countdown for make-ready
    if (tRes.data?.work_type === 'make-ready' && tRes.data?.work_started_at && (activeRole === 'admin' || activeRole === 'supervisor')) {
      const elapsed = await getBusinessDaysElapsed(new Date(tRes.data.work_started_at));
      setCountdown(getCountdownDaysRemaining(elapsed));
    }

    setLoading(false);
  }, [id, activeRole]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const changeStatus = async (newStatus: string) => {
    if (!ticket || !user) return;
    setChangingStatus(true);

    const updates: any = { status: newStatus };
    if (newStatus === 'in_progress' && !ticket.work_started_at) {
      updates.work_started_at = new Date().toISOString();
    }
    if (newStatus === 'closed') {
      updates.closed_at = new Date().toISOString();
      updates.approved_by = user.id;
    }

    await supabase.from('tickets').update(updates).eq('id', id);

    // Add timeline entry
    await supabase.from('ticket_timeline').insert({
      ticket_id: id,
      from_status: ticket.status,
      to_status: newStatus,
      changed_by: user.id,
      note: statusNote || null,
    });

    setStatusNote('');
    toast.success(`Status changed to ${statusLabels[newStatus]}`);
    await fetchTicket();
    setChangingStatus(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !user) return;
    const file = e.target.files[0];
    const path = `${id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('ticket-photos').upload(path, file);
    if (uploadError) { toast.error('Upload failed'); return; }
    const { data: { publicUrl } } = supabase.storage.from('ticket-photos').getPublicUrl(path);
    await supabase.from('ticket_photos').insert({
      ticket_id: id,
      url: publicUrl,
      stage: ticket.status,
      technician_id: user.id,
    });
    toast.success('Photo uploaded');
    fetchTicket();
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>;
  if (!ticket) return <div className="p-4 text-muted-foreground">Ticket not found</div>;

  const colors = workTypeColors[ticket.work_type ?? 'repair'] ?? workTypeColors.repair;
  const transitions = statusTransitions[ticket.status ?? ''];
  const allowedNextStatuses = transitions?.next.filter(() => transitions.roles.includes(activeRole ?? '')) ?? [];

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-lg font-bold text-foreground">{ticket.fs_number ?? 'No FS#'}</span>
            <Badge className={`text-xs ${colors.badge}`}>{(ticket.work_type ?? 'repair').replace('-', ' ').toUpperCase()}</Badge>
            <Badge className={`text-xs ${statusColors[ticket.status ?? 'draft']}`}>{statusLabels[ticket.status ?? 'draft']}</Badge>
          </div>
        </div>
        {(activeRole === 'admin' || activeRole === 'supervisor') && (
          <Button variant="outline" size="sm" onClick={() => navigate(`/tickets/${id}/edit`)}>
            <Edit className="w-4 h-4 mr-1" /> Edit
          </Button>
        )}
      </div>

      {/* Countdown for make-ready (admin/supervisor only) */}
      {countdown !== null && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border`}>
          <Clock className={`w-5 h-5 ${getCountdownColor(countdown)}`} />
          <span className={`text-sm font-bold ${getCountdownColor(countdown)}`}>
            {countdown} business day{countdown !== 1 ? 's' : ''} remaining
          </span>
        </div>
      )}

      {/* Info */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Property</span>
            <p className="text-foreground font-medium">{ticket.property_id ? properties[ticket.property_id]?.name : '—'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Unit</span>
            <p className="text-foreground font-medium">{ticket.unit || '—'}</p>
          </div>
          {activeRole !== 'technician' && (
            <div>
              <span className="text-muted-foreground">Client / PM</span>
              <p className="text-foreground font-medium">{ticket.client_id ? clients[ticket.client_id] : '—'}</p>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Zone</span>
            <p className="text-foreground font-medium">{ticket.zone_id ? zones[ticket.zone_id] : '—'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Technician</span>
            <p className="text-foreground font-medium">{ticket.technician_id ? users[ticket.technician_id] : <span className="text-destructive">Unassigned</span>}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Appointment</span>
            <p className="text-foreground font-medium">
              {ticket.appointment_time ? new Date(ticket.appointment_time).toLocaleString('en-US', { timeZone: 'America/New_York' }) : '—'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Priority</span>
            <p className="text-foreground font-medium capitalize">{ticket.priority ?? 'Normal'}</p>
          </div>
        </div>

        {ticket.description && (
          <div>
            <span className="text-muted-foreground text-sm">Description</span>
            <p className="text-foreground text-sm mt-1">{ticket.description}</p>
          </div>
        )}

        {activeRole !== 'technician' && ticket.internal_note && (
          <div>
            <span className="text-muted-foreground text-sm">Internal Note</span>
            <p className="text-foreground text-sm mt-1 italic">{ticket.internal_note}</p>
          </div>
        )}
      </div>

      {/* Status actions */}
      {allowedNextStatuses.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <span className="text-sm font-semibold text-foreground">Change Status</span>
          <Textarea
            placeholder="Add a note (optional)..."
            value={statusNote}
            onChange={e => setStatusNote(e.target.value)}
            rows={2}
          />
          <div className="flex gap-2 flex-wrap">
            {allowedNextStatuses.map(s => (
              <Button
                key={s}
                variant={s === 'cancelled' ? 'destructive' : 'outline'}
                size="sm"
                disabled={changingStatus}
                onClick={() => changeStatus(s)}
              >
                {s === 'in_progress' && !ticket.work_started_at ? 'Start Work' : statusLabels[s]}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="timeline">
        <TabsList className="w-full">
          <TabsTrigger value="timeline" className="flex-1"><MessageSquare className="w-4 h-4 mr-1" /> Timeline</TabsTrigger>
          <TabsTrigger value="photos" className="flex-1"><Camera className="w-4 h-4 mr-1" /> Photos ({photos.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="timeline" className="space-y-2 mt-4">
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No timeline entries</p>
          ) : (
            timeline.map((entry: any) => (
              <div key={entry.id} className="flex gap-3 border-l-2 border-border pl-4 py-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] ${statusColors[entry.to_status ?? '']}`}>{statusLabels[entry.to_status ?? '']}</Badge>
                    <span className="text-xs text-muted-foreground">from {statusLabels[entry.from_status ?? '']}</span>
                  </div>
                  {entry.note && <p className="text-sm text-foreground mt-1">{entry.note}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    {entry.changed_by ? users[entry.changed_by] : 'System'} · {new Date(entry.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </TabsContent>
        <TabsContent value="photos" className="mt-4">
          <div className="space-y-3">
            <label className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:bg-secondary transition-colors">
              <Camera className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">Upload Photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {photos.map((photo: any) => (
                <div key={photo.id} className="rounded-lg overflow-hidden border border-border">
                  <img src={photo.url} alt="" className="w-full h-32 object-cover" />
                  <div className="p-2">
                    <Badge className="text-[10px]" variant="outline">{photo.stage ?? 'unknown'}</Badge>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(photo.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TicketDetail;
