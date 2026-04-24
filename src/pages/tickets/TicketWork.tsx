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
import { ArrowLeft, Camera, Pause, Play, CheckCircle, MapPin, Navigation, Wifi, WifiOff, Send, AlertTriangle, Clock, FileText } from 'lucide-react';
import { workTypeColors, statusLabels, statusColors } from '@/lib/ticketColors';
import Spinner from '@/components/ui/Spinner';
import { Checkbox } from '@/components/ui/checkbox';
import { getChecklistFor } from '@/lib/workChecklists';

type WorkType = 'make-ready' | 'repair' | 'emergency' | 'capex';
type WorkStep =
  | 'start'           // make-ready: start work button
  | 'en_camino'       // repair/emergency: on my way
  | 'llegue'          // repair/emergency: arrived (upload + advance)
  | 'evaluation_form' // repair/emergency/capex: fill evaluation
  | 'evaluation_pending' // waiting for admin decision after evaluation submitted
  | 'estimate_pending'   // capex: waiting for estimate -> PM approval
  | 'reschedule_pending' // capex: estimate approved, waiting reschedule
  | 'working'
  | 'ready_for_review';

const normalizeWorkType = (wt?: string | null): WorkType => {
  if (!wt) return 'repair';
  const k = wt.toLowerCase().replace('_', '-');
  if (k === 'make-ready' || k === 'repair' || k === 'emergency' || k === 'capex') return k as WorkType;
  return 'repair';
};

const stepDefs: Record<WorkType, { key: WorkStep; label: string }[]> = {
  'make-ready': [
    { key: 'working', label: 'Working' },
    { key: 'ready_for_review', label: 'Review' },
    { key: 'ready_for_review', label: 'Closed' },
  ],
  repair: [
    { key: 'en_camino', label: 'On My Way' },
    { key: 'llegue', label: 'Arrived' },
    { key: 'evaluation_form', label: 'Evaluation' },
    { key: 'working', label: 'Working' },
    { key: 'ready_for_review', label: 'Review' },
    { key: 'ready_for_review', label: 'Closed' },
  ],
  emergency: [
    { key: 'en_camino', label: 'On My Way' },
    { key: 'llegue', label: 'Arrived' },
    { key: 'evaluation_form', label: 'Evaluation' },
    { key: 'working', label: 'Working' },
    { key: 'ready_for_review', label: 'Review' },
    { key: 'ready_for_review', label: 'Closed' },
  ],
  capex: [
    { key: 'evaluation_form', label: 'Evaluation' },
    { key: 'estimate_pending', label: 'Estimate' },
    { key: 'reschedule_pending', label: 'Approved' },
    { key: 'working', label: 'Working' },
    { key: 'ready_for_review', label: 'Review' },
    { key: 'ready_for_review', label: 'Closed' },
  ],
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

  // Evaluation form
  const [evaluationText, setEvaluationText] = useState('');
  const [submittingEval, setSubmittingEval] = useState(false);

  // Target completion date (Working step)
  const [targetDate, setTargetDate] = useState('');
  const [savingDate, setSavingDate] = useState(false);

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
    setTargetDate(((tRes.data as any)?.target_completion_date as string) ?? '');

    const pMap: Record<string, { name: string; address: string }> = {};
    (pRes.data ?? []).forEach((p: any) => { pMap[p.id] = { name: p.name ?? '', address: p.address ?? '' }; });
    setProperties(pMap);

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

  const workType: WorkType = normalizeWorkType(ticket?.work_type);

  const getCurrentStep = (): WorkStep => {
    if (!ticket) return 'start';
    const s = ticket.status;

    if (s === 'ready_for_review') return 'ready_for_review';
    if (s === 'paused') return 'working';

    if (workType === 'make-ready') {
      if (s === 'open') return 'start';
      return 'working';
    }

    if (workType === 'capex') {
      if (s === 'open' && !ticket.evaluation_submitted_at) return 'evaluation_form';
      if (s === 'pending_evaluation') return 'evaluation_pending';
      if (s === 'estimate_pending' || s === 'estimate_sent') return 'estimate_pending';
      if (s === 'estimate_approved') return 'reschedule_pending';
      if (s === 'in_progress') return 'working';
      // Default for capex: if evaluation submitted but unknown intermediate → working
      if (ticket.evaluation_submitted_at && !ticket.work_started_at) return 'evaluation_pending';
      return 'working';
    }

    // repair / emergency
    if (s === 'open') return 'en_camino';
    if (s === 'pending_evaluation') return 'evaluation_pending';
    if (s === 'in_progress') {
      if (ticket.work_started_at) return 'working';
      if (ticket.evaluation_submitted_at) return 'working';
      // Arrived but evaluation not yet submitted
      return 'llegue';
    }
    return 'en_camino';
  };

  const currentStep = getCurrentStep();
  const currentPhotos = photos.filter((p: any) => p.ticket_id === id);
  const hasEvaluationPhoto = currentPhotos.some((p: any) => p.stage === 'evaluation');
  const pendingSyncPhotos = currentPhotos.filter((p: any) => p.is_pending_sync);

  const handleUploadPhoto = async (stage: string, file?: File) => {
    const f = file;
    if (!f || !user) return;
    setUploading(true);

    if (!isOnline) {
      const localUrl = URL.createObjectURL(f);
      await supabase.from('ticket_photos').insert({
        ticket_id: id, url: localUrl, stage, technician_id: user.id, is_pending_sync: true,
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

  const logTimeline = async (from: string, to: string, note: string) => {
    if (!user) return;
    await supabase.from('ticket_timeline').insert({
      ticket_id: id, from_status: from, to_status: to, changed_by: user.id, note,
    });
  };

  // Make-Ready: Start Work
  const startMakeReadyWork = async () => {
    if (!ticket || !user) return;
    await supabase.from('tickets').update({
      status: 'in_progress',
      work_started_at: new Date().toISOString(),
    }).eq('id', id);
    await logTimeline(ticket.status, 'in_progress', 'Make-ready: work started');
    toast.success('Work started');
    fetchData();
  };

  // Repair/Emergency: On My Way
  const onMyWay = async () => {
    if (!ticket || !user) return;
    await supabase.from('tickets').update({ status: 'in_progress' }).eq('id', id);
    await logTimeline(ticket.status, 'in_progress', 'Technician: On My Way');
    toast.success('On My Way');
    fetchData();
  };

  // Repair/Emergency: Arrived (no status change, just timeline marker; show evaluation form)
  // The evaluation form is rendered when at 'llegue' step.

  const submitEvaluation = async () => {
    if (!ticket || !user) return;
    if (!hasEvaluationPhoto) { toast.error('Upload at least 1 evaluation photo'); return; }
    if (!evaluationText.trim()) { toast.error('Description required'); return; }
    setSubmittingEval(true);
    await supabase.from('tickets').update({
      status: 'pending_evaluation',
      evaluation_description: evaluationText.trim(),
      evaluation_submitted_at: new Date().toISOString(),
    } as any).eq('id', id);
    await logTimeline(ticket.status, 'pending_evaluation', `Evaluation submitted: ${evaluationText.trim().slice(0, 200)}`);
    toast.success('Evaluation submitted');
    setEvaluationText('');
    setSubmittingEval(false);
    fetchData();
  };

  const toggleChecklistItem = async (item: string) => {
    if (!ticket) return;
    const current = (ticket.checklist_progress ?? {}) as Record<string, boolean>;
    const next = { ...current, [item]: !current[item] };
    await supabase.from('tickets').update({ checklist_progress: next }).eq('id', id);
    setTicket({ ...ticket, checklist_progress: next });
  };

  const saveTargetDate = async (value: string) => {
    if (!ticket) return;
    setSavingDate(true);
    await supabase.from('tickets').update({ target_completion_date: value || null } as any).eq('id', id);
    setSavingDate(false);
    toast.success(value ? 'Target date saved' : 'Target date cleared');
  };

  const handlePause = async () => {
    if (!pauseReason.trim()) { toast.error('Reason required'); return; }
    await supabase.from('tickets').update({ status: 'paused' }).eq('id', id);
    await logTimeline(ticket.status, 'paused', `Paused: ${pauseReason}${pauseReturnDate ? ` | Est. return: ${pauseReturnDate}` : ''}`);
    setPauseReason(''); setPauseReturnDate(''); setShowPause(false);
    toast.success('Ticket paused');
    fetchData();
  };

  const handleMarkComplete = async () => {
    if (!closePhoto) { toast.error('Closing photo required'); return; }
    if (!closeNote.trim()) { toast.error('Closing note required'); return; }
    await handleUploadPhoto('close', closePhoto);
    await supabase.from('tickets').update({ status: 'ready_for_review' }).eq('id', id);
    await logTimeline(ticket.status, 'ready_for_review', `Completed: ${closeNote}`);
    setClosePhoto(null); setCloseNote(''); setShowComplete(false);
    toast.success('Submitted for review');
    try { await supabase.functions.invoke('notify-ready-for-review', { body: { ticket_id: id } }); } catch { /* */ }
    fetchData();
  };

  const resumeWork = async () => {
    await supabase.from('tickets').update({ status: 'in_progress' }).eq('id', id);
    await logTimeline('paused', 'in_progress', 'Resumed work');
    toast.success('Work resumed');
    fetchData();
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>;
  if (!ticket) return <div className="p-4 text-muted-foreground">Ticket not found</div>;

  const colors = workTypeColors[ticket.work_type ?? 'repair'] ?? workTypeColors.repair;
  const address = ticket.property_id ? properties[ticket.property_id]?.address : null;
  const steps = stepDefs[workType];

  // Determine active step index for progress indicator
  const activeStepIndex = (() => {
    if (ticket.status === 'ready_for_review') return steps.length - 2; // Review
    if (ticket.status === 'closed') return steps.length - 1;
    const idx = steps.findIndex(s => s.key === currentStep);
    return idx === -1 ? 0 : idx;
  })();

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

      {/* Step Indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {steps.map((step, i) => {
          const active = i === activeStepIndex;
          const done = i < activeStepIndex || ticket.status === 'closed';
          return (
            <div key={`${step.label}-${i}`} className="flex items-center flex-shrink-0">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                active ? 'bg-primary text-primary-foreground border-primary'
                : done ? 'bg-green-500/15 text-green-500 border-green-500/30'
                : 'bg-card text-muted-foreground border-border'
              }`}>
                {done && !active ? <CheckCircle className="w-3 h-3" /> : <span className="font-bold">{i + 1}</span>}
                <span>{step.label}</span>
              </div>
              {i < steps.length - 1 && <div className={`w-3 h-px ${done ? 'bg-green-500/40' : 'bg-border'}`} />}
            </div>
          );
        })}
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

      {/* Step content */}
      <div className="space-y-3">
        {ticket.status === 'paused' ? (
          <Button className="w-full" size="lg" onClick={resumeWork}>
            <Play className="w-5 h-5 mr-2" /> Resume Work
          </Button>
        ) : currentStep === 'ready_for_review' ? (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-foreground font-medium">Submitted for Review</p>
            <p className="text-sm text-muted-foreground">Waiting for admin approval</p>
          </div>
        ) : (
          <>
            {/* MAKE-READY: Start */}
            {currentStep === 'start' && workType === 'make-ready' && (
              <Button className="w-full" size="lg" onClick={startMakeReadyWork}>
                <Play className="w-5 h-5 mr-2" /> Start Work
              </Button>
            )}

            {/* REPAIR/EMERGENCY: On My Way */}
            {currentStep === 'en_camino' && (
              <Button className="w-full" size="lg" onClick={onMyWay}>
                <Navigation className="w-5 h-5 mr-2" /> On My Way
              </Button>
            )}

            {/* REPAIR/EMERGENCY: Arrived → Evaluation form */}
            {currentStep === 'llegue' && (
              <>
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-sm text-foreground font-medium">You've arrived. Submit your evaluation below.</span>
                </div>

                <label className="flex items-center justify-center gap-2 w-full px-4 py-3 border border-dashed border-primary/40 rounded-lg cursor-pointer hover:bg-primary/5 transition-colors">
                  <Camera className="w-5 h-5 text-primary" />
                  <span className="text-sm text-primary font-medium">Upload Evaluation Photo {!hasEvaluationPhoto && '(required)'}</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoInput('evaluation')} />
                </label>

                <div className="bg-card border border-border rounded-lg p-4 space-y-2">
                  <Label>What did you find?</Label>
                  <Textarea value={evaluationText} onChange={e => setEvaluationText(e.target.value)} rows={4} placeholder="Describe what you found at the property..." />
                </div>

                <Button className="w-full" size="lg" disabled={!hasEvaluationPhoto || !evaluationText.trim() || submittingEval} onClick={submitEvaluation}>
                  {submittingEval ? <Spinner size="sm" /> : <><Send className="w-5 h-5 mr-2" /> Submit to Admin</>}
                </Button>
              </>
            )}

            {/* CAPEX: Evaluation form (no arrival step) */}
            {currentStep === 'evaluation_form' && workType === 'capex' && (
              <>
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-sm text-foreground font-medium">CapEx evaluation — submit findings for estimate.</span>
                </div>

                <label className="flex items-center justify-center gap-2 w-full px-4 py-3 border border-dashed border-primary/40 rounded-lg cursor-pointer hover:bg-primary/5 transition-colors">
                  <Camera className="w-5 h-5 text-primary" />
                  <span className="text-sm text-primary font-medium">Upload Evaluation Photo {!hasEvaluationPhoto && '(required)'}</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoInput('evaluation')} />
                </label>

                <div className="bg-card border border-border rounded-lg p-4 space-y-2">
                  <Label>Findings & scope</Label>
                  <Textarea value={evaluationText} onChange={e => setEvaluationText(e.target.value)} rows={4} placeholder="Describe scope and conditions for the estimate..." />
                </div>

                <Button className="w-full" size="lg" disabled={!hasEvaluationPhoto || !evaluationText.trim() || submittingEval} onClick={submitEvaluation}>
                  {submittingEval ? <Spinner size="sm" /> : <><Send className="w-5 h-5 mr-2" /> Submit to Admin</>}
                </Button>
              </>
            )}

            {/* Evaluation pending admin */}
            {currentStep === 'evaluation_pending' && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 text-center space-y-3">
                <Clock className="w-10 h-10 text-yellow-500 mx-auto" />
                <p className="text-foreground font-medium">Evaluation submitted</p>
                <p className="text-sm text-muted-foreground">
                  {workType === 'capex' ? 'Waiting for admin to prepare estimate.' : 'Waiting for admin decision.'}
                </p>
                {ticket.evaluation_description && (
                  <div className="text-left bg-background rounded p-3 mt-3 border border-border">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Your Evaluation</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.evaluation_description}</p>
                  </div>
                )}
              </div>
            )}

            {/* CapEx: estimate pending PM approval */}
            {currentStep === 'estimate_pending' && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6 text-center space-y-2">
                <Clock className="w-10 h-10 text-blue-500 mx-auto" />
                <p className="text-foreground font-medium">Waiting for PM Approval</p>
                <p className="text-sm text-muted-foreground">Estimate sent to the Property Manager. You'll be notified once approved.</p>
              </div>
            )}

            {/* CapEx: estimate approved, awaiting reschedule */}
            {currentStep === 'reschedule_pending' && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 text-center space-y-2">
                <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
                <p className="text-foreground font-medium">Estimate Approved</p>
                <p className="text-sm text-muted-foreground">Waiting to be rescheduled by admin.</p>
              </div>
            )}

            {/* WORKING step (all flows) */}
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

                {/* Optional Target Completion Date */}
                <div className="bg-card border border-border rounded-lg p-4 space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Target Completion Date (optional)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={targetDate}
                      onChange={e => setTargetDate(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={() => saveTargetDate(targetDate)}
                      disabled={savingDate}
                    >
                      Save
                    </Button>
                  </div>
                </div>

                <label className="flex items-center justify-center gap-2 w-full px-4 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:bg-secondary transition-colors">
                  <Camera className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Upload Progress Photo</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoInput('process')} />
                </label>

                <Button className="w-full" size="lg" onClick={() => setShowComplete(true)}>
                  <CheckCircle className="w-5 h-5 mr-2" /> Mark Complete
                </Button>
              </>
            )}
          </>
        )}

        {/* Pause visible during active work */}
        {['open', 'in_progress'].includes(ticket.status) && currentStep === 'working' && (
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
