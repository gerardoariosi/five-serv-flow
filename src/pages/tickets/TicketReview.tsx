import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Check, XCircle, Send, AlertTriangle, Clock } from 'lucide-react';
import { workTypeColors, statusLabels, statusColors } from '@/lib/ticketColors';
import Spinner from '@/components/ui/Spinner';
import SendPMReportModal from '@/components/tickets/SendPMReportModal';

const TicketReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeRole, user } = useAuthStore();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<any[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);
  const [property, setProperty] = useState<{ name: string; address: string } | null>(null);
  const [pmEmail, setPmEmail] = useState<string>('');
  const [showPMReport, setShowPMReport] = useState(false);

  // Reject modal
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Approve confirm
  const [showApprove, setShowApprove] = useState(false);
  const [approved, setApproved] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [tRes, phRes, uRes] = await Promise.all([
      supabase.from('tickets').select('*').eq('id', id).single(),
      supabase.from('ticket_photos').select('*').eq('ticket_id', id).order('uploaded_at', { ascending: true }),
      supabase.rpc('get_user_directory'),
    ]);
    setTicket(tRes.data);
    setPhotos(phRes.data ?? []);
    const uMap: Record<string, string> = {};
    (uRes.data ?? []).forEach((u: any) => { uMap[u.id] = u.full_name ?? ''; });
    setUsers(uMap);
    setApproved(tRes.data?.status === 'closed');

    if (tRes.data?.property_id) {
      const { data: prop } = await supabase
        .from('properties').select('name, address').eq('id', tRes.data.property_id).single();
      if (prop) setProperty({ name: prop.name ?? '', address: prop.address ?? '' });
    }
    if (tRes.data?.client_id) {
      const { data: cli } = await supabase
        .from('clients').select('email').eq('id', tRes.data.client_id).single();
      setPmEmail(cli?.email ?? '');
    }

    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = async () => {
    if (!user) return;
    setProcessing(true);
    await supabase.from('tickets').update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      approved_by: user.id,
    }).eq('id', id);
    await supabase.from('ticket_timeline').insert({
      ticket_id: id,
      from_status: ticket.status,
      to_status: 'closed',
      changed_by: user.id,
      note: 'Approved and closed',
    });
    setShowApprove(false);
    setApproved(true);
    toast.success('Ticket approved and closed');
    fetchData();
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error('Rejection reason is required'); return; }
    if (!user) return;
    setProcessing(true);
    await supabase.from('tickets').update({
      status: 'rejected',
      rejection_count: (ticket.rejection_count ?? 0) + 1,
    }).eq('id', id);
    await supabase.from('ticket_timeline').insert({
      ticket_id: id,
      from_status: ticket.status,
      to_status: 'rejected',
      changed_by: user.id,
      note: `Rejected: ${rejectReason}`,
    });
    setRejectReason('');
    setShowReject(false);
    toast.success('Ticket rejected — returned to In Progress');
    fetchData();
    setProcessing(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>;
  if (!ticket) return <div className="p-4 text-muted-foreground">Ticket not found</div>;

  const colors = workTypeColors[ticket.work_type ?? 'repair'] ?? workTypeColors.repair;
  const hasPendingSync = photos.some((p: any) => p.is_pending_sync);

  // Group photos by stage
  const photosByStage: Record<string, any[]> = {};
  photos.forEach((p: any) => {
    const stage = p.stage ?? 'other';
    if (!photosByStage[stage]) photosByStage[stage] = [];
    photosByStage[stage].push(p);
  });

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-5">
      {/* Approve Confirm */}
      <Dialog open={showApprove} onOpenChange={setShowApprove}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve & Close Ticket?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will close the ticket and record your approval. This action is logged.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprove(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleApprove} disabled={processing}>Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Ticket</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Technician will be notified. Ticket returns to In Progress.</p>
          <Textarea placeholder="Reason for rejection (required)..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing}>Reject</Button>
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
            <span className="font-mono text-lg font-bold text-foreground">{ticket.fs_number}</span>
            <Badge className={`text-xs ${statusColors['ready_for_review']}`}>Ready for Review</Badge>
            {(ticket.rejection_count ?? 0) > 0 && (
              <Badge variant="outline" className="text-xs text-destructive border-destructive">
                {ticket.rejection_count} rejection{ticket.rejection_count > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Pending Sync Warning */}
      {hasPendingSync && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30">
          <AlertTriangle className="w-4 h-4 text-orange-400" />
          <span className="text-sm text-orange-400 font-medium">Some photos are pending sync — review may be incomplete</span>
        </div>
      )}

      {/* Info */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Technician</span>
            <p className="text-foreground font-medium">{ticket.technician_id ? users[ticket.technician_id] : '—'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Work Type</span>
            <Badge className={`text-xs ${colors.badge}`}>{(ticket.work_type ?? '').replace('-', ' ').toUpperCase()}</Badge>
          </div>
          <div>
            <span className="text-muted-foreground">Appointment</span>
            <p className="text-foreground font-medium text-xs">
              {ticket.appointment_time ? new Date(ticket.appointment_time).toLocaleString('en-US', { timeZone: 'America/New_York' }) : '—'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Work Started</span>
            <p className="text-foreground font-medium text-xs">
              {ticket.work_started_at ? new Date(ticket.work_started_at).toLocaleString('en-US', { timeZone: 'America/New_York' }) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Photos by stage */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-foreground">Photos</h3>
        {['start', 'process', 'close', 'initial', 'other'].map(stage => {
          const stagePhotos = photosByStage[stage];
          if (!stagePhotos?.length) return null;
          return (
            <div key={stage}>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 capitalize">{stage}</h4>
              <div className="grid grid-cols-2 gap-3">
                {stagePhotos.map((photo: any) => (
                  <div key={photo.id} className="rounded-lg overflow-hidden border border-border relative">
                    <img src={photo.url} alt="" className="w-full h-40 object-cover" />
                    {photo.is_pending_sync && (
                      <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-orange-500 text-white text-[9px] font-bold rounded">PENDING</div>
                    )}
                    <div className="p-2">
                      <p className="text-[10px] text-muted-foreground">
                        {photo.technician_id ? users[photo.technician_id] : ''} · {new Date(photo.uploaded_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      {!approved && ticket.status === 'ready_for_review' && (
        <div className="flex gap-3 pt-4">
          <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" size="lg" onClick={() => setShowApprove(true)} disabled={processing}>
            <Check className="w-5 h-5 mr-2" /> Approve
          </Button>
          <Button className="flex-1" variant="destructive" size="lg" onClick={() => setShowReject(true)} disabled={processing}>
            <XCircle className="w-5 h-5 mr-2" /> Reject
          </Button>
        </div>
      )}

      {/* Post-approval: Send Report */}
      {approved && (
        <div className="text-center space-y-3 py-4">
          <Check className="w-12 h-12 text-green-500 mx-auto" />
          <p className="text-foreground font-medium">Ticket Approved</p>
          <p className="text-xs text-muted-foreground">
            Approved by {ticket.approved_by ? users[ticket.approved_by] : '—'} · {ticket.closed_at ? new Date(ticket.closed_at).toLocaleString('en-US', { timeZone: 'America/New_York' }) : ''}
          </p>
          <Button variant="outline" onClick={() => setShowPMReport(true)}>
            <Send className="w-4 h-4 mr-2" /> Send Report to PM
          </Button>
        </div>
      )}

      <SendPMReportModal
        open={showPMReport}
        onOpenChange={setShowPMReport}
        ticket={ticket}
        propertyName={property?.name}
        propertyAddress={property?.address}
        technicianName={ticket?.technician_id ? users[ticket.technician_id] : ''}
        pmEmail={pmEmail}
        photos={photos}
      />
    </div>
  );
};

export default TicketReview;
