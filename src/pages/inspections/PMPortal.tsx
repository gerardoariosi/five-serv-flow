import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Shield, Lock, Mail, Check, AlertTriangle, Camera, Download, ZoomIn, Info, ChevronDown, ChevronUp } from 'lucide-react';
import SignaturePad from '@/components/inspections/SignaturePad';
import Spinner from '@/components/ui/Spinner';

const PMPortal = () => {
  const { token } = useParams();
  const [inspection, setInspection] = useState<any>(null);
  const [property, setProperty] = useState<{ name: string | null; address: string | null } | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [photos, setPhotos] = useState<Record<string, any[]>>({});
  const [techNotes, setTechNotes] = useState<Record<string, string>>({});
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
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [generalNote, setGeneralNote] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    const { data: ins } = await supabase.from('inspections').select('*').eq('pm_link_token', token).single();
    if (!ins) { setLoading(false); return; }

    // Track link open
    await supabase.from('inspections').update({
      link_opened_count: (ins.link_opened_count ?? 0) + 1,
    }).eq('id', ins.id);

    // Check expiry
    if (ins.link_expires_at && new Date(ins.link_expires_at) < new Date()) {
      setExpired(true);
      setLoading(false);
      return;
    }

    // Check if already submitted
    if (ins.pm_submitted_at) {
      setSubmitted(true);
      setReadOnly(true);
    }

    setInspection(ins);

    // Fetch property info for hero card
    if (ins.property_id) {
      const { data: prop } = await supabase
        .from('properties')
        .select('name, address')
        .eq('id', ins.property_id)
        .single();
      setProperty(prop ?? null);
    }

    // Fetch items needing repair
    const { data: itemsData } = await supabase.from('inspection_items')
      .select('*')
      .eq('inspection_id', ins.id)
      .in('status', ['needs_repair', 'urgent'])
      .order('status', { ascending: true });
    setItems(itemsData ?? []);

    // Extract technician notes per area (from the `note` column)
    const notesMap: Record<string, string> = {};
    (itemsData ?? []).forEach((item: any) => {
      if (item.note && !notesMap[item.area]) {
        notesMap[item.area] = item.note;
      }
    });
    setTechNotes(notesMap);

    // Fetch inspection photos
    const { data: photosData } = await supabase.from('inspection_photos')
      .select('*')
      .eq('inspection_id', ins.id)
      .order('uploaded_at', { ascending: true });

    const photosMap: Record<string, any[]> = {};
    for (const p of (photosData ?? [])) {
      const area = p.area ?? 'other';
      if (!photosMap[area]) photosMap[area] = [];
      if (p.url && !p.url.startsWith('http')) {
        const { data: signedData } = await supabase.storage.from('inspection-photos').createSignedUrl(p.url, 3600);
        photosMap[area].push({ ...p, displayUrl: signedData?.signedUrl || p.url });
      } else {
        photosMap[area].push({ ...p, displayUrl: p.url });
      }
    }
    setPhotos(photosMap);

    // Pre-select items that PM had selected (read-only mode)
    if (ins.pm_submitted_at) {
      const selected = new Set<string>();
      const notes: Record<string, string> = {};
      (itemsData ?? []).forEach((item: any) => {
        if (item.pm_selected) selected.add(item.id);
        if (item.pm_note) notes[item.id] = item.pm_note;
      });
      setSelectedItems(selected);
      setItemNotes(notes);
    }

    setLoading(false);
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Force light mode
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.setProperty('color-scheme', 'light');
    return () => {
      document.documentElement.style.removeProperty('color-scheme');
    };
  }, []);

  const handlePin = async () => {
    if (!token || !pinInput) return;
    setPinLoading(true);
    setPinError('');
    try {
      const { data, error } = await supabase.functions.invoke('verify-portal-pin', {
        body: { token, pin: pinInput },
      });
      if (error) throw error;
      if (data?.valid) {
        setPinEntered(true);
      } else {
        setPinError('Incorrect PIN. Please contact FiveServ.');
      }
    } catch {
      setPinError('Unable to verify PIN. Please try again.');
    }
    setPinLoading(false);
  };

  const toggleItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const total = useMemo(() =>
    items.filter(i => selectedItems.has(i.id))
      .reduce((sum, i) => sum + ((i.quantity ?? 1) * (i.unit_price ?? 0)), 0)
  , [items, selectedItems]);

  // Get unique areas from items for grouping photos/notes
  const areas = useMemo(() => {
    const areaSet = new Set<string>();
    items.forEach(i => { if (i.area) areaSet.add(i.area); });
    Object.keys(photos).forEach(a => areaSet.add(a));
    Object.keys(techNotes).forEach(a => areaSet.add(a));
    return Array.from(areaSet);
  }, [items, photos, techNotes]);

  const handleSubmit = async () => {
    if (!signatureData) { toast.error('Signature is required'); return; }
    setSubmitting(true);

    // Update each item with PM selections
    for (const item of items) {
      await supabase.from('inspection_items').update({
        pm_selected: selectedItems.has(item.id),
        pm_note: itemNotes[item.id] || null,
      }).eq('id', item.id);
    }

    // Update inspection
    await supabase.from('inspections').update({
      pm_submitted_at: new Date().toISOString(),
      pm_signature_data: signatureData,
      pm_total_selected: total,
      pm_general_note: generalNote || null,
      status: 'pm_responded',
    } as any).eq('id', inspection.id);

    // Notify admin via transactional email
    try {
      // Get admin email from company_profile
      const { data: company } = await supabase.from('company_profile').select('contact_email').limit(1).single();
      const adminEmail = company?.contact_email;
      // Get property name and client name
      const { data: prop } = inspection.property_id
        ? await supabase.from('properties').select('name').eq('id', inspection.property_id).single()
        : { data: null };
      const { data: client } = inspection.client_id
        ? await supabase.from('clients').select('company_name').eq('id', inspection.client_id).single()
        : { data: null };

      if (adminEmail) {
        await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'pm-response-received',
            recipientEmail: adminEmail,
            idempotencyKey: `pm-response-${inspection.id}`,
            templateData: {
              ins_number: inspection.ins_number ?? '',
              property_name: prop?.name ?? 'N/A',
              pm_name: client?.company_name ?? 'N/A',
              items_approved: selectedItems.size,
              total_approved: total.toFixed(2),
              detail_url: `${window.location.origin}/inspections/${inspection.id}`,
            },
          },
        });
      }
    } catch (err) {
      console.error('Admin notification failed', err);
    }

    setShowConfirm(false);
    setSubmitted(true);
    setReadOnly(true);
    toast.success('Response submitted successfully');
    setSubmitting(false);
  };

  // Expired page
  if (expired) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <Lock className="w-16 h-16 text-gray-400 mx-auto" />
          <h1 className="text-xl font-bold text-gray-900">Link Expired</h1>
          <p className="text-gray-600">This inspection link has expired. Please contact FiveServ for assistance.</p>
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

  if (!inspection) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto" />
          <h1 className="text-xl font-bold text-gray-900">Inspection Not Found</h1>
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
            <div className="inline-block bg-[#1A1A1A] px-6 py-4 rounded">
              <span style={{ fontFamily: 'Georgia, serif', fontWeight: 'bold', letterSpacing: '-0.01em', fontSize: '2.4rem' }}>
                <span style={{ color: '#FFD700' }}>F</span>
                <span style={{ color: '#FFFFFF' }}>iveServ</span>
              </span>
              <div className="text-[9px] tracking-[0.2em] mt-2" style={{ color: '#FFD700' }}>FIVE DAYS. ONE CALL. DONE.</div>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mt-4">Inspection Report</h1>
            <p className="text-sm text-gray-500 mt-1">Enter your access PIN to view this report.</p>
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
              {pinLoading ? <Spinner size="sm" /> : 'Access Report'}
            </Button>
          </div>
          <p className="text-[10px] text-gray-400 text-center">
            By accessing this report, you agree to FiveServ's privacy policy. This data is confidential.
          </p>
        </div>
      </div>
    );
  }

  // Group items by area
  const itemsByArea: Record<string, any[]> = {};
  items.forEach(i => {
    const area = i.area ?? 'other';
    if (!itemsByArea[area]) itemsByArea[area] = [];
    itemsByArea[area].push(i);
  });

  // Main portal
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Confirm dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle className="text-gray-900">Confirm Submission</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">Once submitted, your response cannot be modified. Please review your selections carefully.</p>
          <p className="text-sm font-bold text-gray-900">Total: ${total.toFixed(2)}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Review Again</Button>
            <Button className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : 'Submit Response'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header — black bar with FiveServ wordmark */}
      <div className="sticky top-0 z-10 shadow-sm">
        <div className="bg-[#1A1A1A] px-4 py-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex-1" />
            <span style={{ fontFamily: 'Georgia, serif', fontWeight: 'bold', letterSpacing: '-0.01em', fontSize: '1.5rem' }}>
              <span style={{ color: '#FFD700' }}>F</span>
              <span style={{ color: '#FFFFFF' }}>iveServ</span>
            </span>
            <div className="flex-1 flex justify-end">
              {readOnly && (
                <Badge className="bg-green-500/20 text-green-300 border border-green-500/40 text-[10px] uppercase tracking-wider">Submitted</Badge>
              )}
            </div>
          </div>
        </div>
        {/* Gold 2px line */}
        <div style={{ height: '2px', backgroundColor: '#FFD700' }} />
        {/* Property + INS subtitle */}
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <div className="max-w-2xl mx-auto flex items-center justify-between text-xs text-gray-500">
            <span className="truncate">{property?.name || property?.address || 'Property'}</span>
            <span className="font-medium text-gray-700">{inspection.ins_number || '—'}</span>
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
            </div>
            <div className="sm:text-right">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Visit Date</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">
                {inspection.visit_date
                  ? new Date(inspection.visit_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                  : '—'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Inspection {inspection.ins_number || ''}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {submitted && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <Check className="w-6 h-6 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">Response submitted</p>
              <p className="text-xs text-green-600">
                Submitted on {inspection.pm_submitted_at ? new Date(inspection.pm_submitted_at).toLocaleString('en-US', { timeZone: 'America/New_York' }) : ''}
              </p>
            </div>
          </div>
        )}

        {/* Instructions guide */}
        {!submitted && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowInstructions(prev => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                <Info className="w-4 h-4" /> How to Complete This Report
              </span>
              {showInstructions ? <ChevronUp className="w-4 h-4 text-blue-600" /> : <ChevronDown className="w-4 h-4 text-blue-600" />}
            </button>
            {showInstructions && (
              <div className="px-4 pb-3 space-y-1.5">
                <p className="text-xs text-blue-700">This is the inspection report for your property. Please review and approve the repair items you'd like completed.</p>
                <ul className="text-xs text-blue-700 list-disc pl-4 space-y-1">
                  <li><strong>Select items</strong> — Check the box next to each repair you approve</li>
                  <li><strong>Add notes</strong> — Add optional notes per item for special instructions</li>
                  <li><strong>Review total</strong> — Your selected total updates automatically</li>
                  <li><strong>Sign & submit</strong> — Draw your signature at the bottom and click Submit</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Items, notes, and photos grouped by area */}
        {areas.map(area => {
          const areaPhotos = photos[area] ?? [];
          const areaNote = techNotes[area];
          const areaItems = itemsByArea[area] ?? [];
          if (areaItems.length === 0 && areaPhotos.length === 0 && !areaNote) return null;
          return (
            <div key={area} className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
              {/* Area title bar — dark header */}
              <div className="px-5 py-3 bg-gray-900 flex items-center gap-3">
                <div className="w-1 h-5 rounded-sm" style={{ backgroundColor: '#FFD700' }} />
                <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em]">{area.replace(/_/g, ' ')}</h3>
              </div>

              {/* Items — invoice style rows */}
              <div>
                {areaItems.map((item: any) => {
                  const subtotal = (item.quantity ?? 1) * (item.unit_price ?? 0);
                  const isSelected = selectedItems.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`px-5 py-4 border-b border-gray-100 last:border-0 transition-all duration-150 ${
                        isSelected
                          ? 'bg-[#FFFBEB] border-l-4 border-l-[#FFD700]'
                          : 'bg-white border-l-4 border-l-transparent hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => !readOnly && toggleItem(item.id)}
                          disabled={readOnly}
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors mt-0.5 ${
                            isSelected ? 'bg-[#FFD700] border-[#FFD700]' : 'border-gray-300 bg-white'
                          } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                          aria-label={isSelected ? 'Deselect item' : 'Select item'}
                        >
                          {isSelected && <Check className="w-4 h-4 text-black" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-900">{item.item_name}</p>
                              <p className="text-xs text-gray-500 mt-0.5">Qty {item.quantity ?? 1} × ${(item.unit_price ?? 0).toFixed(2)}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-gray-900 tabular-nums">${subtotal.toFixed(2)}</p>
                              <Badge className={`text-[10px] mt-1 ${item.status === 'urgent' ? 'bg-red-100 text-red-700 hover:bg-red-100' : 'bg-orange-100 text-orange-700 hover:bg-orange-100'}`}>
                                {item.status === 'urgent' ? 'Urgent' : 'Needs Repair'}
                              </Badge>
                            </div>
                          </div>

                          {item.item_note && (
                            <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md">
                              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-0.5">Technician Note</p>
                              <p className="text-xs text-amber-800">{item.item_note}</p>
                            </div>
                          )}

                          {!readOnly && (
                            <div className="mt-2">
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Your Note (optional)</p>
                              <Textarea
                                placeholder="Add a note for this item..."
                                value={itemNotes[item.id] ?? ''}
                                onChange={e => setItemNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                                rows={1}
                                className="text-xs bg-gray-50 border-gray-200 text-gray-900 resize-none focus:ring-1 focus:ring-yellow-400"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Technician note */}
              {areaNote && (
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Technician Note</p>
                  <p className="text-sm text-gray-700">{areaNote}</p>
                </div>
              )}

              {/* Photos — cleaner grid with captions */}
              {areaPhotos.length > 0 && (
                <div className="px-5 py-4 border-t border-gray-100">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Photos</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {areaPhotos.map((p: any, i: number) => (
                      <div
                        key={p.id ?? i}
                        className="cursor-pointer group"
                        onClick={() => setLightboxUrl(p.displayUrl || p.url)}
                      >
                        <div className="relative rounded-lg overflow-hidden border border-gray-100 transition-all duration-200 group-hover:shadow-md group-hover:opacity-90">
                          <img src={p.displayUrl || p.url} alt={`${area} photo ${i + 1}`} className="w-full h-28 object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                            <ZoomIn className="w-5 h-5 text-white drop-shadow-md" />
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1 text-center capitalize">{area.replace(/_/g, ' ')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Total — prominent dark bar */}
        <div className="bg-gray-900 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Selected Total</p>
            <p className="text-xs text-gray-500 mt-0.5">{selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected</p>
          </div>
          <p className="text-3xl font-bold tabular-nums" style={{ color: '#FFD700' }}>${total.toFixed(2)}</p>
        </div>

        {/* General note */}
        {!readOnly && (
          <div>
            <Label className="text-gray-700">General Note (optional)</Label>
            <Textarea
              value={generalNote}
              onChange={e => setGeneralNote(e.target.value)}
              rows={3}
              placeholder="Any additional comments..."
              className="bg-white border-gray-200 text-gray-900"
            />
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
              By signing, you authorize <span className="font-semibold text-gray-700">FiveServ Property Solutions</span> to proceed with selected work.
            </p>
          </div>
        )}

        {/* Read-only signature display */}
        {readOnly && inspection.pm_signature_data && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <Label className="text-gray-700 mb-2 block font-semibold">Signature</Label>
            <div className="border border-gray-100 rounded-lg p-2 bg-gray-50" dangerouslySetInnerHTML={{ __html: inspection.pm_signature_data }} />
          </div>
        )}

        {/* Submit */}
        {!readOnly && (
          <Button
            className="w-full bg-[#1A1A1A] hover:bg-black text-white font-bold border-b-2"
            style={{ borderBottomColor: '#FFD700' }}
            size="lg"
            onClick={() => setShowConfirm(true)}
            disabled={!signatureData || selectedItems.size === 0}
          >
            Submit Response
          </Button>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-12 bg-[#1A1A1A] text-white">
        <div style={{ height: '2px', backgroundColor: '#FFD700' }} />
        <div className="max-w-2xl mx-auto px-4 py-6 text-center space-y-2">
          <div><span style={{ fontFamily: 'Georgia, serif', fontWeight: 'bold', letterSpacing: '-0.01em', fontSize: '1.6rem' }}><span style={{ color: '#FFD700' }}>F</span><span style={{ color: '#FFFFFF' }}>iveServ</span></span></div>
          <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: '#FFD700' }}>Five Days. One Call. Done.</p>
          <p className="text-[11px] text-gray-300 mt-2">Licensed &amp; Insured · Central Florida</p>
          <p className="text-[11px] text-gray-300">
            <a href="mailto:info@fiveserv.net" className="hover:text-white">info@fiveserv.net</a>
            {' · '}
            <a href="tel:+14078814942" className="hover:text-white">(407) 881-4942</a>
          </p>
          <p className="text-[10px] italic text-gray-500 pt-2">This document is confidential.</p>
        </div>
      </footer>

      {/* Image lightbox */}
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

export default PMPortal;
