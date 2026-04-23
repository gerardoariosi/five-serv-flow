import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Edit, Clock, Camera, MessageSquare, MapPin, StickyNote, AlertTriangle, DollarSign, Send, UserPlus, Check, XCircle, RotateCcw, Trash2 } from 'lucide-react';
import { workTypeColors, statusLabels, statusColors } from '@/lib/ticketColors';
import { getBusinessDaysElapsed, getCountdownDaysRemaining, getCountdownColor } from '@/lib/businessDays';
import Spinner from '@/components/ui/Spinner';
import SendPMReportModal from '@/components/tickets/SendPMReportModal';

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

  // Modals
  const [showDelayNote, setShowDelayNote] = useState(false);
  const [delayNoteText, setDelayNoteText] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTechId, setAssignTechId] = useState('');
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPMReport, setShowPMReport] = useState(false);

  // Lookup maps
  const [clients, setClients] = useState<Record<string, { name: string; email: string }>>({});
  const [properties, setProperties] = useState<Record<string, { name: string; address: string }>>({});
  const [zones, setZones] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<Record<string, { name: string; email: string }>>({});

  const fetchTicket = useCallback(async () => {
    if (!id) return;
    const [tRes, tlRes, phRes, cRes, pRes, zRes, uRes, techRes] = await Promise.all([
      supabase.from('tickets').select('*').eq('id', id).single(),
      supabase.from('ticket_timeline').select('*').eq('ticket_id', id).order('created_at', { ascending: false }),
      supabase.from('ticket_photos').select('*').eq('ticket_id', id).order('uploaded_at', { ascending: false }),
      supabase.from('clients').select('id, company_name, email'),
      supabase.from('properties').select('id, name, address'),
      supabase.from('zones').select('id, name'),
      supabase.from('users').select('id, full_name, email'),
      supabase.from('users').select('id, full_name, email, roles').filter('roles', 'cs', '{"technician"}'),
    ]);

    setTicket(tRes.data);
    setTimeline(tlRes.data ?? []);
    setPhotos(phRes.data ?? []);
    setTechnicians(techRes.data ?? []);

    const cMap: Record<string, { name: string; email: string }> = {};
    (cRes.data ?? []).forEach((c: any) => { cMap[c.id] = { name: c.company_name ?? '', email: c.email ?? '' }; });
    setClients(cMap);
    const pMap: Record<string, { name: string; address: string }> = {};
    (pRes.data ?? []).forEach((p: any) => { pMap[p.id] = { name: p.name ?? '', address: p.address ?? '' }; });
    setProperties(pMap);
    const zMap: Record<string, string> = {};
    (zRes.data ?? []).forEach((z: any) => { zMap[z.id] = z.name ?? ''; });
    setZones(zMap);
    const uMap: Record<string, { name: string; email: string }> = {};
    (uRes.data ?? []).forEach((u: any) => { uMap[u.id] = { name: u.full_name ?? '', email: u.email ?? '' }; });
    setUsers(uMap);

    if (['make-ready', 'make_ready'].includes(tRes.data?.work_type ?? '') && tRes.data?.work_started_at && (activeRole === 'admin' || activeRole === 'supervisor')) {
      const elapsed = await getBusinessDaysElapsed(new Date(tRes.data.work_started_at));
      setCountdown(getCountdownDaysRemaining(elapsed));
    }

    setLoading(false);
  }, [id, activeRole]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  // Realtime: refresh on ticket / timeline / photo changes
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`ticket-detail-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `id=eq.${id}` }, () => fetchTicket())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_timeline', filter: `ticket_id=eq.${id}` }, () => fetchTicket())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_photos', filter: `ticket_id=eq.${id}` }, () => fetchTicket())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, fetchTicket]);

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

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error('Rejection reason is required'); return; }
    setChangingStatus(true);
    await supabase.from('tickets').update({
      status: 'rejected',
      rejection_count: (ticket.rejection_count ?? 0) + 1,
    }).eq('id', id);
    await supabase.from('ticket_timeline').insert({
      ticket_id: id,
      from_status: ticket.status,
      to_status: 'rejected',
      changed_by: user?.id,
      note: `Rejected: ${rejectReason}`,
    });
    setRejectReason('');
    setShowRejectModal(false);
    toast.success('Ticket rejected');
    await fetchTicket();
    setChangingStatus(false);
  };

  const handleLogDelayNote = async () => {
    if (!delayNoteText.trim()) return;
    await supabase.from('ticket_timeline').insert({
      ticket_id: id,
      from_status: ticket.status,
      to_status: ticket.status,
      changed_by: user?.id,
      note: `[Delay Note] ${delayNoteText}`,
    });
    setDelayNoteText('');
    setShowDelayNote(false);
    toast.success('Delay note logged');
    fetchTicket();
  };

  const handleAssignTech = async () => {
    if (!assignTechId) return;
    await supabase.from('tickets').update({ technician_id: assignTechId }).eq('id', id);
    await supabase.from('ticket_timeline').insert({
      ticket_id: id,
      from_status: ticket.status,
      to_status: ticket.status,
      changed_by: user?.id,
      note: `Technician assigned: ${users[assignTechId]?.name || assignTechId}`,
    });
    // Email technician
    try {
      const techEmail = users[assignTechId]?.email;
      if (techEmail) {
        await supabase.functions.invoke('send-business-email', {
          body: {
            template_name: 'technician_assigned',
            to_email: techEmail,
            variables: {
              fs_number: ticket.fs_number ?? '',
              property_name: ticket.property_id ? properties[ticket.property_id]?.name ?? '' : '',
              work_type: (ticket.work_type ?? '').replace('-', ' '),
              appointment_time: ticket.appointment_time
                ? new Date(ticket.appointment_time).toLocaleString('en-US', { timeZone: 'America/New_York' })
                : 'Not scheduled',
              technician_name: users[assignTechId]?.name ?? '',
            },
          },
        });
      }
    } catch { /* non-blocking */ }
    setAssignTechId('');
    setShowAssignModal(false);
    toast.success('Technician assigned');
    fetchTicket();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !user) return;
    const file = e.target.files[0];
    const path = `${id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('ticket-photos').upload(path, file);
    if (uploadError) { toast.error('Upload failed'); return; }
    const { data: { publicUrl } } = supabase.storage.from('ticket-photos').getPublicUrl(path);
    await supabase.from('ticket_photos').insert({
      ticket_id: id, url: publicUrl, stage: ticket.status, technician_id: user.id,
    });
    toast.success('Photo uploaded');
    fetchTicket();
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>;
  if (!ticket) return <div className="p-4 text-muted-foreground">Ticket not found</div>;

  const colors = workTypeColors[ticket.work_type ?? 'repair'] ?? workTypeColors.repair;
  const transitions = statusTransitions[ticket.status ?? ''];
  const allowedNextStatuses = (transitions?.next ?? []).filter(() => transitions?.roles?.includes(activeRole ?? ''));
  const isAdminOrSupervisor = activeRole === 'admin' || activeRole === 'supervisor';
  const isAdminOrAccounting = activeRole === 'admin' || activeRole === 'accounting';
  const hasPendingSync = photos.some((p: any) => p.is_pending_sync);

  // Group photos by stage
  const photosByStage: Record<string, any[]> = {};
  photos.forEach((p: any) => {
    const stage = p.stage ?? 'other';
    if (!photosByStage[stage]) photosByStage[stage] = [];
    photosByStage[stage].push(p);
  });

  const propertyAddress = ticket.property_id ? properties[ticket.property_id]?.address : null;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-5">
      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Ticket</DialogTitle></DialogHeader>
          <Textarea placeholder="Reason for rejection (required)..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={changingStatus}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delay Note Modal */}
      <Dialog open={showDelayNote} onOpenChange={setShowDelayNote}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log Delay Note</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Internal only. No notifications sent.</p>
          <Textarea placeholder="Describe the delay..." value={delayNoteText} onChange={e => setDelayNoteText(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelayNote(false)}>Cancel</Button>
            <Button onClick={handleLogDelayNote}>Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Technician Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Technician</DialogTitle></DialogHeader>
          <Select value={assignTechId} onValueChange={setAssignTechId}>
            <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
            <SelectContent>
              {technicians.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>Cancel</Button>
            <Button onClick={handleAssignTech}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            {(ticket.rejection_count ?? 0) > 0 && (
              <Badge variant="outline" className="text-xs text-destructive border-destructive">
                {ticket.rejection_count} rejection{ticket.rejection_count > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
        {isAdminOrSupervisor && (
          <Button variant="outline" size="sm" onClick={() => navigate(`/tickets/${id}/edit`)}>
            <Edit className="w-4 h-4 mr-1" /> Edit
          </Button>
        )}
      </div>

      {/* Pending sync warning */}
      {hasPendingSync && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30">
          <AlertTriangle className="w-4 h-4 text-orange-400" />
          <span className="text-sm text-orange-400 font-medium">Some photos are pending sync</span>
        </div>
      )}

      {/* Countdown */}
      {countdown !== null && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border">
          <Clock className={`w-5 h-5 ${getCountdownColor(countdown)}`} />
          <span className={`text-sm font-bold ${getCountdownColor(countdown)}`}>
            {countdown} business day{countdown !== 1 ? 's' : ''} remaining
          </span>
        </div>
      )}

      {/* Info Card */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {isAdminOrSupervisor && (
            <div>
              <span className="text-muted-foreground">Client / PM</span>
              <p className="text-foreground font-medium">{ticket.client_id ? clients[ticket.client_id]?.name : '—'}</p>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Property</span>
            <p className="text-foreground font-medium">{ticket.property_id ? properties[ticket.property_id]?.name : '—'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Unit</span>
            <p className="text-foreground font-medium">{ticket.unit || '—'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Zone</span>
            <p className="text-foreground font-medium">{ticket.zone_id ? zones[ticket.zone_id] : '—'}</p>
          </div>
          {propertyAddress && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Address</span>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(propertyAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline font-medium"
              >
                <MapPin className="w-3 h-3" /> {propertyAddress}
              </a>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Technician</span>
            <p className="text-foreground font-medium">
              {ticket.technician_id ? users[ticket.technician_id]?.name : <span className="text-destructive">Unassigned</span>}
            </p>
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
          {ticket.work_started_at && (
            <div>
              <span className="text-muted-foreground">Work Started</span>
              <p className="text-foreground font-medium">
                {new Date(ticket.work_started_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}
              </p>
            </div>
          )}
        </div>

        {ticket.description && (
          <div>
            <span className="text-muted-foreground text-sm">Description</span>
            <p className="text-foreground text-sm mt-1">{ticket.description}</p>
          </div>
        )}

        {/* Internal Note — different bg, admin/supervisor only */}
        {isAdminOrSupervisor && ticket.internal_note && (
          <div className="bg-secondary/50 border border-border rounded-md p-3">
            <div className="flex items-center gap-1 mb-1">
              <StickyNote className="w-3 h-3 text-primary" />
              <span className="text-xs font-semibold text-primary">Internal Note</span>
            </div>
            <p className="text-foreground text-sm italic">{ticket.internal_note}</p>
          </div>
        )}
      </div>

      {/* Accounting Section — Admin/Accounting only */}
      {isAdminOrAccounting && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Billing</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Billing Status</span>
              <p className="text-foreground font-medium capitalize">{ticket.billing_status ?? 'Pending'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">QB Invoice #</span>
              <p className="text-foreground font-medium">{ticket.qb_invoice_number || '—'}</p>
            </div>
          </div>
          {ticket.accounting_notes && (
            <div>
              <span className="text-muted-foreground text-sm">Accounting Notes</span>
              <p className="text-foreground text-sm mt-1">{ticket.accounting_notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap [&>button]:w-full [&>button]:sm:w-auto">
        {/* Assign Technician */}
        {isAdminOrSupervisor && !ticket.technician_id && (
          <Button size="sm" onClick={() => setShowAssignModal(true)}>
            <UserPlus className="w-4 h-4 mr-1" /> Assign Technician
          </Button>
        )}

        {/* Approve / Reject for ready_for_review */}
        {isAdminOrSupervisor && ticket.status === 'ready_for_review' && (
          <>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => changeStatus('closed')} disabled={changingStatus}>
              <Check className="w-4 h-4 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setShowRejectModal(true)}>
              <XCircle className="w-4 h-4 mr-1" /> Reject
            </Button>
          </>
        )}

        {/* Reopen closed */}
        {activeRole === 'admin' && ticket.status === 'closed' && (
          <Button size="sm" variant="outline" onClick={() => changeStatus('open')} disabled={changingStatus}>
            <RotateCcw className="w-4 h-4 mr-1" /> Reopen
          </Button>
        )}

        {/* Reopen cancelled */}
        {isAdminOrSupervisor && ticket.status === 'cancelled' && (
          <Button size="sm" variant="outline" onClick={() => changeStatus('open')} disabled={changingStatus}>
            <RotateCcw className="w-4 h-4 mr-1" /> Reopen
          </Button>
        )}

        {/* Permanently Delete — admin only, draft or cancelled */}
        {activeRole === 'admin' && (ticket.status === 'draft' || ticket.status === 'cancelled') && (
          <Button size="sm" variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="w-4 h-4 mr-1" /> Permanently Delete
          </Button>
        )}

        {/* Delete confirmation dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent>
            <DialogHeader><DialogTitle>Permanently Delete Ticket?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">This action cannot be undone. The ticket, all photos, and timeline entries will be permanently removed.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button variant="destructive" onClick={async () => {
                await supabase.from('ticket_photos').delete().eq('ticket_id', id);
                await supabase.from('ticket_timeline').delete().eq('ticket_id', id);
                await supabase.from('tickets').delete().eq('id', id);
                toast.success('Ticket deleted');
                navigate('/tickets');
              }}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Send Report to PM — after close */}
        {isAdminOrSupervisor && ticket.status === 'closed' && (
          <Button size="sm" variant="outline" onClick={() => setShowPMReport(true)}>
            <Send className="w-4 h-4 mr-1" /> Send Report to PM
          </Button>
        )}

        {/* Log Delay Note — any status */}
        {isAdminOrSupervisor && (
          <Button size="sm" variant="outline" onClick={() => setShowDelayNote(true)}>
            <StickyNote className="w-4 h-4 mr-1" /> Log Delay Note
          </Button>
        )}

        {/* General status changes (draft→open, open→cancel, etc) */}
        {allowedNextStatuses.filter(s => !['closed', 'rejected', 'open'].includes(s) || (s === 'open' && ticket.status === 'draft')).map(s => (
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

      {/* Tabs: Timeline + Photos */}
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
                    {entry.from_status !== entry.to_status && (
                      <span className="text-xs text-muted-foreground">from {statusLabels[entry.from_status ?? '']}</span>
                    )}
                  </div>
                  {entry.note && <p className="text-sm text-foreground mt-1">{entry.note}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    {entry.changed_by ? users[entry.changed_by]?.name : 'System'} · {new Date(entry.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </TabsContent>
        <TabsContent value="photos" className="mt-4 space-y-4">
          <label className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:bg-secondary transition-colors">
            <Camera className="w-5 h-5 text-primary" />
            <span className="text-sm text-muted-foreground">Upload Photo</span>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </label>

          {/* Photos by stage */}
          {Object.entries(photosByStage).map(([stage, stagePhotos]) => (
            <div key={stage}>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 capitalize">{stage}</h4>
              <div className="grid grid-cols-2 gap-3">
                {stagePhotos.map((photo: any) => (
                  <div key={photo.id} className="rounded-lg overflow-hidden border border-border relative">
                    <img src={photo.url} alt="" className="w-full h-36 object-cover" />
                    {photo.is_pending_sync && (
                      <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-orange-500 text-white text-[9px] font-bold rounded">PENDING</div>
                    )}
                    <div className="p-2">
                      <p className="text-[10px] text-muted-foreground">
                        {photo.technician_id ? users[photo.technician_id]?.name : ''} · {new Date(photo.uploaded_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {/* Send PM Report Modal */}
      <SendPMReportModal
        open={showPMReport}
        onOpenChange={setShowPMReport}
        ticket={ticket}
        propertyName={ticket?.property_id ? properties[ticket.property_id]?.name : ''}
        propertyAddress={ticket?.property_id ? properties[ticket.property_id]?.address : ''}
        technicianName={ticket?.technician_id ? users[ticket.technician_id]?.name : ''}
        pmEmail={ticket?.client_id ? clients[ticket.client_id]?.email : ''}
        photos={photos}
        lastTimelineNote={timeline.find((t: any) => t.note)?.note}
      />
    </div>
  );
};

export default TicketDetail;
