import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Camera, Pause, Play, CheckCircle, MapPin, Navigation, Wrench, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { workTypeColors, statusLabels, statusColors } from '@/lib/ticketColors';
import Spinner from '@/components/ui/Spinner';
import { Checkbox } from '@/components/ui/checkbox';
import { getChecklistFor } from '@/lib/workChecklists';

type WorkStep = 'en_camino' | 'llegue' | 'evaluation' | 'working' | 'ready_for_review';

const stepLabels: Record<WorkStep, string> = {
  en_camino: 'En Camino',
  llegue: 'Llegué',
  evaluation: 'Submit Evaluation',
  working: 'Working',
  ready_for_review: 'Ready for Review',
};

const TicketWork = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<any[]>([]);
  const [propertyPhotos, setPropertyPhotos] = useState<any[]>([]);
  const [properties, setProperties] = useState<Record<string, { name: string; address: string }>>({});
  const [uploading, setUploading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Pause modal
  const [showPause, setShowPause] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [pauseReturnDate, setPauseReturnDate] = useState('');

  // Complete modal
  const [showComplete, setShowComplete] = useState(false);
  const [closeNote, setCloseNote] = useState('');
  const [closePhoto, setClosePhoto] = useState<File | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [tRes, phRes, pRes] = await Promise.all([
      supabase.from('tickets').select('*').eq('id', id).single(),
      supabase.from('ticket_photos').select('*').eq('ticket_id', id).order('uploaded_at', { ascending: true }),
      supabase.from('properties').select('id, name, address'),
    ]);
    setTicket(tRes.data);
    setPhotos(phRes.data ?? []);

    const pMap: Record<string, { name: string; address: string }> = {};
    (pRes.data ?? []).forEach((p: any) => { pMap[p.id] = { name: p.name ?? '', address: p.address ?? '' }; });
    setProperties(pMap);

    // Fetch full property photo history if technician has active ticket
    if (tRes.data?.property_id) {
      const { data: propTickets } = await supabase.from('tickets').select('id').eq('property_id', tRes.data.property_id);
      if (propTickets && propTickets.length > 0) {
        const ticketIds = propTickets.map((t: any) => t.id);
        const { data: allPhotos } = await supabase.from('ticket_photos').select('*').in('ticket_id', ticketIds).order('uploaded_at', { ascending: false });
        setPropertyPhotos(allPhotos ?? []);
      }
    }

    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getCurrentStep = (): WorkStep => {
    if (!ticket) return 'en_camino';
    const status = ticket.status;
    if (status === 'open') return 'en_camino';
    if (status === 'in_progress') return ticket.work_started_at ? 'working' : 'llegue';
    if (status === 'paused') return 'working';
    if (status === 'ready_for_review') return 'ready_for_review';
    return 'en_camino';
  };

  const currentStep = getCurrentStep();
  const currentPhotos = photos.filter((p: any) => p.ticket_id === id);
  const hasStartPhoto = currentPhotos.some((p: any) => p.stage === 'start' || p.stage === 'open' || p.stage === 'in_progress');
  const pendingSyncPhotos = currentPhotos.filter((p: any) => p.is_pending_sync);

  const handleUploadPhoto = async (stage: string, file?: File) => {
    const f = file;
    if (!f || !user) return;
    setUploading(true);

    if (!isOnline) {
      // Save locally with pending flag
      const localUrl = URL.createObjectURL(f);
      await supabase.from('ticket_photos').insert({
        ticket_id: id,
        url: localUrl,
        stage,
        technician_id: user.id,
        is_pending_sync: true,
      });
      toast.info('Photo saved locally. Will sync when online.');
      setUploading(false);
      fetchData();
      return;
    }

    const path = `${id}/${Date.now()}-${f.name}`;
    const { error } = await supabase.storage.from('ticket-photos').upload(path, f);
    if (error) { toast.error('Upload failed'); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('ticket-photos').getPublicUrl(path);
    await supabase.from('ticket_photos').insert({
      ticket_id: id, url: publicUrl, stage, technician_id: user.id, is_pending_sync: false,
    });
    toast.success('Photo uploaded');
    setUploading(false);
    fetchData();
  };

  const handlePhotoInput = (stage: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleUploadPhoto(stage, e.target.files[0]);
    e.target.value = '';
  };

  const advanceStep = async (step: WorkStep) => {
    if (!ticket || !user) return;

    if (step === 'working' && !hasStartPhoto) {
      toast.error('Upload at least 1 photo before starting work');
      return;
    }

    let newStatus = ticket.status;
    const updates: any = {};

    if (step === 'en_camino') {
      newStatus = 'in_progress';
    } else if (step === 'llegue') {
      newStatus = 'in_progress';
    } else if (step === 'working') {
      newStatus = 'in_progress';
      updates.work_started_at = new Date().toISOString();
    } else if (step === 'ready_for_review') {
      setShowComplete(true);
      return;
    }

    updates.status = newStatus;
    await supabase.from('tickets').update(updates).eq('id', id);
    await supabase.from('ticket_timeline').insert({
      ticket_id: id, from_status: ticket.status, to_status: newStatus,
      changed_by: user.id, note: `Technician: ${stepLabels[step]}`,
    });
    toast.success(stepLabels[step]);
    fetchData();
  };

  const toggleChecklistItem = async (item: string) => {
    if (!ticket) return;
    const current = (ticket.checklist_progress ?? {}) as Record<string, boolean>;
    const next = { ...current, [item]: !current[item] };
    await supabase.from('tickets').update({ checklist_progress: next }).eq('id', id);
    setTicket({ ...ticket, checklist_progress: next });
  };

  const handlePause = async () => {
    if (!pauseReason.trim()) { toast.error('Reason required'); return; }
    await supabase.from('tickets').update({ status: 'paused' }).eq('id', id);
    await supabase.from('ticket_timeline').insert({
      ticket_id: id, from_status: ticket.status, to_status: 'paused',
      changed_by: user?.id, note: `Paused: ${pauseReason}${pauseReturnDate ? ` | Est. return: ${pauseReturnDate}` : ''}`,
    });
    setPauseReason('');
    setPauseReturnDate('');
    setShowPause(false);
    toast.success('Ticket paused');
    fetchData();
  };

  const handleMarkComplete = async () => {
    if (!closePhoto) { toast.error('Closing photo required'); return; }
    if (!closeNote.trim()) { toast.error('Closing note required'); return; }

    await handleUploadPhoto('close', closePhoto);

    await supabase.from('tickets').update({ status: 'ready_for_review' }).eq('id', id);
    await supabase.from('ticket_timeline').insert({
      ticket_id: id, from_status: ticket.status, to_status: 'ready_for_review',
      changed_by: user?.id, note: `Completed: ${closeNote}`,
    });
    setClosePhoto(null);
    setCloseNote('');
    setShowComplete(false);
    toast.success('Submitted for review');

    // Fan-out emails to admins
    try {
      await supabase.functions.invoke('notify-ready-for-review', { body: { ticket_id: id } });
    } catch { /* non-blocking */ }

    fetchData();
  };

  const resumeWork = async () => {
    await supabase.from('tickets').update({ status: 'in_progress' }).eq('id', id);
    await supabase.from('ticket_timeline').insert({
      ticket_id: id, from_status: 'paused', to_status: 'in_progress',
      changed_by: user?.id, note: 'Resumed work',
    });
    toast.success('Work resumed');
    fetchData();
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>;
  if (!ticket) return <div className="p-4 text-muted-foreground">Ticket not found</div>;

  const colors = workTypeColors[ticket.work_type ?? 'repair'] ?? workTypeColors.repair;
  const address = ticket.property_id ? properties[ticket.property_id]?.address : null;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5">
      {/* Pause Modal */}
      <Dialog open={showPause} onOpenChange={setShowPause}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pause Work</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Reason (required)</Label>
              <Textarea value={pauseReason} onChange={e => setPauseReason(e.target.value)} rows={3} placeholder="Why is work paused?" />
            </div>
            <div>
              <Label>Estimated Return Date</Label>
              <Input type="date" value={pauseReturnDate} onChange={e => setPauseReturnDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPause(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handlePause}>Pause</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Modal */}
      <Dialog open={showComplete} onOpenChange={setShowComplete}>
        <DialogContent>
          <DialogHeader><DialogTitle>Complete Work</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Closing Photo (required)</Label>
              <label className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:bg-secondary transition-colors mt-1">
                <Camera className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">{closePhoto ? closePhoto.name : 'Select photo'}</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && setClosePhoto(e.target.files[0])} />
              </label>
            </div>
            <div>
              <Label>Closing Note (required)</Label>
              <Textarea value={closeNote} onChange={e => setCloseNote(e.target.value)} rows={3} placeholder="Describe work completed..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComplete(false)}>Cancel</Button>
            <Button onClick={handleMarkComplete}>Submit for Review</Button>
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
            <Badge className={`text-xs ${colors.badge}`}>{(ticket.work_type ?? 'repair').replace('-', ' ').toUpperCase()}</Badge>
            <Badge className={`text-xs ${statusColors[ticket.status ?? 'open']}`}>{statusLabels[ticket.status ?? 'open']}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isOnline ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-destructive" />}
        </div>
      </div>

      {/* Pending sync indicator */}
      {pendingSyncPhotos.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-orange-500/10 border border-orange-500/30">
          <AlertTriangle className="w-4 h-4 text-orange-400" />
          <span className="text-xs text-orange-400">{pendingSyncPhotos.length} photo{pendingSyncPhotos.length > 1 ? 's' : ''} pending sync</span>
        </div>
      )}

      {/* Property info */}
      <div className="bg-card border border-border rounded-lg p-4">
        <p className="text-sm font-medium text-foreground">{ticket.property_id ? properties[ticket.property_id]?.name : '—'}{ticket.unit ? ` · Unit ${ticket.unit}` : ''}</p>
        {address && (
          <a href={`https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary text-sm hover:underline mt-1">
            <Navigation className="w-3 h-3" /> {address}
          </a>
        )}
        {ticket.description && <p className="text-sm text-muted-foreground mt-2">{ticket.description}</p>}
      </div>

      {/* Step flow buttons */}
      <div className="space-y-3">
        {ticket.status === 'paused' ? (
          <Button className="w-full" size="lg" onClick={resumeWork}>
            <Play className="w-5 h-5 mr-2" /> Resume Work
          </Button>
        ) : ticket.status === 'ready_for_review' ? (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-foreground font-medium">Submitted for Review</p>
            <p className="text-sm text-muted-foreground">Waiting for admin approval</p>
          </div>
        ) : (
          <>
            {currentStep === 'en_camino' && (
              <Button className="w-full" size="lg" onClick={() => advanceStep('en_camino')}>
                <Navigation className="w-5 h-5 mr-2" /> En Camino
              </Button>
            )}
            {currentStep === 'llegue' && (
              <>
                <Button className="w-full" size="lg" variant="outline" onClick={() => advanceStep('llegue')}>
                  <MapPin className="w-5 h-5 mr-2" /> Llegué
                </Button>

                <label className="flex items-center justify-center gap-2 w-full px-4 py-3 border border-dashed border-primary/40 rounded-lg cursor-pointer hover:bg-primary/5 transition-colors">
                  <Camera className="w-5 h-5 text-primary" />
                  <span className="text-sm text-primary font-medium">Upload Start Photo {!hasStartPhoto && '(required)'}</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoInput('start')} />
                </label>

                <Button className="w-full" size="lg" onClick={() => advanceStep('working')} disabled={!hasStartPhoto}>
                  <Wrench className="w-5 h-5 mr-2" /> Start Working
                </Button>
              </>
            )}
            {currentStep === 'working' && (
              <>
                {/* Checklist */}
                {(() => {
                  const items = getChecklistFor(ticket.work_type);
                  if (items.length === 0) return null;
                  const progress = (ticket.checklist_progress ?? {}) as Record<string, boolean>;
                  const done = items.filter(i => progress[i]).length;
                  return (
                    <div className="bg-card border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-foreground">Checklist</h3>
                        <span className="text-xs text-muted-foreground">{done} / {items.length}</span>
                      </div>
                      <div className="space-y-2">
                        {items.map(item => (
                          <label key={item} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={!!progress[item]} onCheckedChange={() => toggleChecklistItem(item)} />
                            <span className={`text-sm ${progress[item] ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{item}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <label className="flex items-center justify-center gap-2 w-full px-4 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:bg-secondary transition-colors">
                  <Camera className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Upload Progress Photo</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoInput('process')} />
                </label>

                <Button className="w-full" size="lg" onClick={() => advanceStep('ready_for_review')}>
                  <CheckCircle className="w-5 h-5 mr-2" /> Mark Complete
                </Button>
              </>
            )}
          </>
        )}

        {/* Pause always visible during active work */}
        {['open', 'in_progress'].includes(ticket.status) && (
          <Button variant="destructive" className="w-full" size="lg" onClick={() => setShowPause(true)}>
            <Pause className="w-5 h-5 mr-2" /> Pause
          </Button>
        )}
      </div>

      {/* Photo history */}
      {currentPhotos.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Photos</h3>
          <div className="grid grid-cols-2 gap-2">
            {currentPhotos.map((photo: any) => (
              <div key={photo.id} className="rounded-lg overflow-hidden border border-border relative">
                <img src={photo.url} alt="" className="w-full h-28 object-cover" />
                {photo.is_pending_sync && (
                  <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-orange-500 text-white text-[9px] font-bold rounded">PENDING</div>
                )}
                <div className="p-1.5">
                  <Badge variant="outline" className="text-[9px]">{photo.stage}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Property photo history */}
      {propertyPhotos.length > currentPhotos.length && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Property Photo History</h3>
          <div className="grid grid-cols-2 gap-2">
            {propertyPhotos.filter((p: any) => p.ticket_id !== id).slice(0, 6).map((photo: any) => (
              <div key={photo.id} className="rounded-lg overflow-hidden border border-border opacity-70">
                <img src={photo.url} alt="" className="w-full h-24 object-cover" />
                <div className="p-1.5">
                  <Badge variant="outline" className="text-[9px]">{photo.stage}</Badge>
                  <p className="text-[9px] text-muted-foreground">{new Date(photo.uploaded_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketWork;
