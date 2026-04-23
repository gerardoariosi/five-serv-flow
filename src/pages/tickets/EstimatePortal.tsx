import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Lock, Mail, Check, AlertTriangle, Download, ZoomIn } from 'lucide-react';
import SignaturePad from '@/components/inspections/SignaturePad';
import Spinner from '@/components/ui/Spinner';

const EstimatePortal = () => {
  const { token } = useParams();
  const [ticket, setTicket] = useState<any>(null);
  const [property, setProperty] = useState<{ name: string | null; address: string | null } | null>(null);
  const [options, setOptions] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

  // Auth
  const [pinEntered, setPinEntered] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Selections
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [pmNote, setPmNote] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    const { data: t } = await supabase.from('tickets').select('*').eq('estimate_link_token', token).maybeSingle();
    if (!t) { setLoading(false); return; }

    // Track open
    await supabase.from('tickets').update({
      estimate_link_opened_count: (t.estimate_link_opened_count ?? 0) + 1,
    }).eq('id', t.id);

    if (t.estimate_expires_at && new Date(t.estimate_expires_at) < new Date()) {
      setExpired(true); setLoading(false); return;
    }

    if (t.estimate_submitted_at) {
      setSubmitted(true);
      setReadOnly(true);
      setSelectedOptionId(''); // we'll match below
      setPmNote(t.estimate_pm_note ?? '');
    }

    setTicket(t);

    if (t.property_id) {
      const { data: prop } = await supabase.from('properties').select('name, address').eq('id', t.property_id).maybeSingle();
      setProperty(prop ?? null);
    }

    const { data: optData } = await supabase
      .from('ticket_estimate_options')
      .select('*')
      .eq('ticket_id', t.id)
      .order('sort_order', { ascending: true });
    setOptions(optData ?? []);

    if (t.estimate_submitted_at && t.estimate_selected_option) {
      const matched = (optData ?? []).find((o: any) => o.option_name === t.estimate_selected_option);
      if (matched) setSelectedOptionId(matched.id);
    }

    // Evaluation photos (stage = 'evaluation')
    const { data: phData } = await supabase
      .from('ticket_photos')
      .select('*')
      .eq('ticket_id', t.id)
      .eq('stage', 'evaluation')
      .order('uploaded_at', { ascending: true });
    setPhotos(phData ?? []);

    setLoading(false);
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Force light mode
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.setProperty('color-scheme', 'light');
    return () => { document.documentElement.style.removeProperty('color-scheme'); };
  }, []);

  const handlePin = async () => {
    if (!token || !pinInput) return;
    setPinLoading(true);
    setPinError('');
    try {
      const { data, error } = await supabase.functions.invoke('verify-portal-pin', {
        body: { token, pin: pinInput, portal_type: 'estimate' },
      });
      if (error) throw error;
      if (data?.valid) setPinEntered(true);
      else setPinError('Incorrect PIN. Please contact FiveServ.');
    } catch {
      setPinError('Unable to verify PIN. Please try again.');
    }
    setPinLoading(false);
  };

  const handleSubmit = async () => {
    if (!signatureData) { toast.error('Signature is required'); return; }
    if (!selectedOptionId) { toast.error('Please select an option'); return; }
    setSubmitting(true);

    const opt = options.find((o: any) => o.id === selectedOptionId);
    if (!opt) { toast.error('Selected option not found'); setSubmitting(false); return; }

    const { error } = await supabase.from('tickets').update({
      estimate_submitted_at: new Date().toISOString(),
      estimate_selected_option: opt.option_name,
      estimate_selected_price: opt.price,
      estimate_pm_signature: signatureData,
      estimate_pm_note: pmNote || null,
      status: 'estimate_approved',
    } as any).eq('id', ticket.id);

    if (error) {
      toast.error('Could not submit. Please try again.');
      setSubmitting(false);
      return;
    }

    setShowConfirm(false);
    setSubmitted(true);
    setReadOnly(true);
    toast.success('Estimate approved');
    setSubmitting(false);
  };

  // Expired
  if (expired) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <Lock className="w-16 h-16 text-gray-400 mx-auto" />
          <h1 className="text-xl font-bold text-gray-900">Link Expired</h1>
          <p className="text-gray-600">This estimate link has expired. Please contact FiveServ for a new estimate.</p>
          <a href="mailto:info@fiveserv.net" className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors">
            <Mail className="w-5 h-5" /> Contact FiveServ
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Spinner size="lg" className="border-gray-300 border-t-yellow-500" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto" />
          <h1 className="text-xl font-bold text-gray-900">Estimate Not Found</h1>
          <p className="text-gray-600">This link may be invalid. Please contact FiveServ for assistance.</p>
          <a href="mailto:info@fiveserv.net" className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors">
            <Mail className="w-5 h-5" /> Contact FiveServ
          </a>
        </div>
      </div>
    );
  }

  // PIN entry
  if (!pinEntered) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-sm w-full space-y-6">
          <div className="text-center">
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontFamily: 'Georgia, serif', fontWeight: 'bold', letterSpacing: '-0.01em', fontSize: '1.8rem' }}>
                <span style={{ color: '#FFD700' }}>F</span>
                <span style={{ color: '#1A1A1A' }}>iveServ</span>
              </span>
              <div style={{ color: '#FFD700', fontSize: '0.6rem', letterSpacing: '0.18em', marginTop: '6px', fontFamily: 'Arial, sans-serif', fontWeight: 600 }}>
                ONE TEAM. ONE CALL. DONE.
              </div>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mt-4">Estimate</h1>
            <p className="text-sm text-gray-500 mt-1">Enter your access PIN to view this estimate.</p>
          </div>
          <div className="space-y-3">
            <Input
              type="password"
              placeholder="Enter PIN"
              value={pinInput}
              onChange={e => { setPinInput(e.target.value); setPinError(''); }}
              onKeyDown={e => e.key === 'Enter' && handlePin()}
              className="text-center text-lg tracking-widest bg-white border-gray-300 text-gray-900"
              maxLength={10}
            />
            {pinError && <p className="text-sm text-red-500 text-center">{pinError}</p>}
            <Button className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold" onClick={handlePin} disabled={pinLoading}>
              {pinLoading ? <Spinner size="sm" /> : 'Access Estimate'}
            </Button>
          </div>
          <p className="text-[10px] text-gray-400 text-center">
            By accessing this estimate, you agree to FiveServ's privacy policy. This data is confidential.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Confirm dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle className="text-gray-900">Confirm Approval</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">Once approved, FiveServ will be authorized to proceed with the selected work. This action cannot be undone.</p>
          {(() => {
            const opt = options.find((o: any) => o.id === selectedOptionId);
            return opt ? (
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                <p className="text-sm font-bold text-gray-900">{opt.option_name}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">${Number(opt.price).toFixed(2)}</p>
              </div>
            ) : null;
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Review Again</Button>
            <Button className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : 'Approve Estimate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="sticky top-0 z-10 shadow-sm">
        <div className="bg-[#1A1A1A] px-4 py-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex-1" />
            <span style={{ fontFamily: 'Georgia, serif', fontWeight: 'bold', letterSpacing: '-0.01em', fontSize: '1.1rem' }}>
              <span style={{ color: '#FFD700' }}>F</span>
              <span style={{ color: '#FFFFFF' }}>iveServ</span>
            </span>
            <div className="flex-1 flex justify-end">
              {readOnly && (
                <Badge className="bg-green-500/20 text-green-300 border border-green-500/40 text-[10px] uppercase tracking-wider">Approved</Badge>
              )}
            </div>
          </div>
        </div>
        <div style={{ height: '2px', backgroundColor: '#FFD700' }} />
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <div className="max-w-2xl mx-auto flex items-center text-xs text-gray-500">
            <span className="truncate">{property?.name || property?.address || 'Property'}</span>
          </div>
        </div>
      </div>

      {/* Hero card */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Property</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{property?.name || '—'}</p>
              {property?.address && <p className="text-xs text-gray-500 mt-0.5">{property.address}</p>}
              {ticket.unit && <p className="text-xs text-gray-500 mt-0.5">Unit {ticket.unit}</p>}
            </div>
            <div className="sm:text-right">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Date Sent</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">
                {new Date(ticket.created_at ?? Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
              
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {submitted && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <Check className="w-6 h-6 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">Estimate approved</p>
              <p className="text-xs text-green-600">
                Approved on {ticket.estimate_submitted_at ? new Date(ticket.estimate_submitted_at).toLocaleString('en-US', { timeZone: 'America/New_York' }) : ''}
              </p>
            </div>
          </div>
        )}

        {/* Problem description */}
        {ticket.estimate_problem_description && (
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
              <div className="w-1 h-5 rounded-sm" style={{ backgroundColor: '#FFD700' }} />
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-[0.15em]">Problem Description</h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.estimate_problem_description}</p>
            </div>

            {photos.length > 0 && (
              <div className="px-5 py-4 border-t border-gray-100">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Photos</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map((p: any, i: number) => (
                    <div key={p.id ?? i} className="cursor-pointer group" onClick={() => setLightboxUrl(p.url)}>
                      <div className="relative rounded-lg overflow-hidden border border-gray-100 transition-all duration-200 group-hover:shadow-md group-hover:opacity-90">
                        <img src={p.url} alt={`Evaluation ${i + 1}`} className="w-full h-28 object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                          <ZoomIn className="w-5 h-5 text-white drop-shadow-md" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Options */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
            <div className="w-1 h-5 rounded-sm" style={{ backgroundColor: '#FFD700' }} />
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-[0.15em]">Select an Option</h3>
          </div>
          <div className="p-5">
            <RadioGroup value={selectedOptionId} onValueChange={(v) => !readOnly && setSelectedOptionId(v)} disabled={readOnly}>
              <div className="space-y-3">
                {options.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-6">No options available yet.</p>
                )}
                {options.map((opt: any) => {
                  const isSelected = selectedOptionId === opt.id;
                  return (
                    <label
                      key={opt.id}
                      htmlFor={`opt-${opt.id}`}
                      className={`block rounded-xl border-2 p-5 cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? 'border-[#FFD700] bg-[#FFFBEB] shadow-md'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                      } ${readOnly ? 'cursor-default' : ''}`}
                    >
                      <RadioGroupItem value={opt.id} id={`opt-${opt.id}`} className="sr-only" />
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                              isSelected ? 'border-[#FFD700] bg-[#FFD700]' : 'border-gray-300 bg-white'
                            }`}
                          >
                            {isSelected && <div className="w-2 h-2 rounded-full bg-black" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900">{opt.option_name}</p>
                            {opt.description && (
                              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed whitespace-pre-wrap">{opt.description}</p>
                            )}
                          </div>
                        </div>
                        <p className="text-xl font-bold text-gray-900 tabular-nums shrink-0">${Number(opt.price).toFixed(2)}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </RadioGroup>
          </div>
        </div>

        {/* PM note */}
        {!readOnly && (
          <div>
            <Label className="text-gray-700">Note (optional)</Label>
            <Textarea
              value={pmNote}
              onChange={e => setPmNote(e.target.value)}
              rows={3}
              placeholder="Any additional comments..."
              className="bg-white border-gray-200 text-gray-900"
            />
          </div>
        )}
        {readOnly && pmNote && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <Label className="text-gray-700 mb-2 block font-semibold">Your Note</Label>
            <p className="text-sm text-gray-700">{pmNote}</p>
          </div>
        )}

        {/* Signature */}
        {!readOnly && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <Label className="text-gray-700 mb-3 block font-semibold">Digital Signature</Label>
            <SignaturePad onSave={setSignatureData} disabled={readOnly} />
            {signatureData && (
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                <Check className="w-3 h-3" /> Signature captured
              </p>
            )}
            <p className="text-[11px] text-gray-500 mt-3 leading-relaxed border-t border-gray-100 pt-3">
              By signing, you authorize <span className="font-semibold text-gray-700">FiveServ Property Solutions</span> to proceed with the selected work.
            </p>
          </div>
        )}

        {readOnly && ticket.estimate_pm_signature && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <Label className="text-gray-700 mb-2 block font-semibold">Signature</Label>
            <div className="border border-gray-100 rounded-lg p-2 bg-gray-50" dangerouslySetInnerHTML={{ __html: ticket.estimate_pm_signature }} />
          </div>
        )}

        {/* Submit */}
        {!readOnly && (
          <Button
            className="w-full bg-[#1A1A1A] hover:bg-black text-white font-bold border-b-2"
            style={{ borderBottomColor: '#FFD700' }}
            size="lg"
            onClick={() => setShowConfirm(true)}
            disabled={!signatureData || !selectedOptionId}
          >
            Approve Estimate
          </Button>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-12 bg-[#1A1A1A] text-white">
        <div style={{ height: '2px', backgroundColor: '#FFD700' }} />
        <div className="max-w-2xl mx-auto px-4 py-6 text-center space-y-2">
          <div><span style={{ fontFamily: 'Georgia, serif', fontWeight: 'bold', letterSpacing: '-0.01em', fontSize: '1.2rem' }}><span style={{ color: '#FFD700' }}>F</span><span style={{ color: '#FFFFFF' }}>iveServ</span></span></div>
          <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: '#FFD700' }}>One Team. One Call. Done.</p>
          <p className="text-[11px] text-gray-300 mt-2">Licensed &amp; Insured · Central Florida</p>
          <p className="text-[11px] text-gray-300">
            <a href="mailto:info@fiveserv.net" className="hover:text-white">info@fiveserv.net</a>
            {' · '}
            <a href="tel:+14078814942" className="hover:text-white">(407) 881-4942</a>
          </p>
          <p className="text-[10px] italic text-gray-500 pt-2">This document is confidential.</p>
        </div>
      </footer>

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-3xl p-2 bg-white">
          {lightboxUrl && (
            <div className="space-y-2">
              <img src={lightboxUrl} alt="" className="w-full max-h-[75vh] object-contain rounded" />
              <div className="flex justify-end">
                <a href={lightboxUrl} download target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1.5 text-gray-700">
                    <Download className="w-4 h-4" /> Save Image
                  </Button>
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EstimatePortal;
