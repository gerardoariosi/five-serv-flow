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
import { Shield, Lock, Mail, Check, AlertTriangle, Camera } from 'lucide-react';
import SignaturePad from '@/components/inspections/SignaturePad';
import Spinner from '@/components/ui/Spinner';

const PMPortal = () => {
  const { token } = useParams();
  const [inspection, setInspection] = useState<any>(null);
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
            <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-yellow-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">FiveServ Inspection</h1>
            <p className="text-sm text-gray-500 mt-1">Enter your access PIN to view the inspection report.</p>
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

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-yellow-600">FS</span>
            <span className="text-sm text-gray-500 ml-2">Inspection Report</span>
          </div>
          {readOnly && (
            <Badge className="bg-green-100 text-green-700 text-xs">Submitted</Badge>
          )}
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

        {/* Items, notes, and photos grouped by area */}
        {areas.map(area => {
          const areaPhotos = photos[area] ?? [];
          const areaNote = techNotes[area];
          const areaItems = itemsByArea[area] ?? [];
          if (areaItems.length === 0 && areaPhotos.length === 0 && !areaNote) return null;
          return (
            <div key={area} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">{area.replace(/_/g, ' ')}</h3>

              {/* Items */}
              {areaItems.map((item: any) => (
                <div key={item.id} className="border border-gray-100 rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedItems.has(item.id)}
                      onCheckedChange={() => !readOnly && toggleItem(item.id)}
                      disabled={readOnly}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{item.item_name}</span>
                        <Badge className={`text-[10px] ${item.status === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                          {item.status === 'urgent' ? 'Urgent' : 'Needs Repair'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-700">
                        <span>Qty: {item.quantity}</span>
                        <span>Price: ${(item.unit_price ?? 0).toFixed(2)}</span>
                        <span className="font-medium">Subtotal: ${((item.quantity ?? 1) * (item.unit_price ?? 0)).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <Textarea
                    placeholder="Add a note (optional)..."
                    value={itemNotes[item.id] ?? ''}
                    onChange={e => !readOnly && setItemNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                    rows={1}
                    className="bg-gray-50 border-gray-200 text-gray-900 text-sm"
                    disabled={readOnly}
                  />
                </div>
              ))}

              {/* Technician note */}
              {areaNote && (
                <div className="bg-gray-50 rounded-md p-2 border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium mb-0.5">Technician Note</p>
                  <p className="text-sm text-gray-700">{areaNote}</p>
                </div>
              )}

              {/* Photos */}
              {areaPhotos.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {areaPhotos.map((p: any, i: number) => (
                    <div key={p.id ?? i} className="rounded-lg overflow-hidden border border-gray-200">
                      <img src={p.displayUrl || p.url} alt="" className="w-full h-28 object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Total */}
        <div className="bg-white border-2 border-yellow-400 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-900">Selected Total</span>
          <span className="text-xl font-bold text-yellow-600">${total.toFixed(2)}</span>
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
          <div>
            <Label className="text-gray-700 mb-2 block">Digital Signature</Label>
            <SignaturePad onSave={setSignatureData} disabled={readOnly} />
            {signatureData && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" /> Signature captured
              </p>
            )}
          </div>
        )}

        {/* Read-only signature display */}
        {readOnly && inspection.pm_signature_data && (
          <div>
            <Label className="text-gray-700 mb-2 block">Signature</Label>
            <div className="border border-gray-200 rounded-lg p-2 bg-white" dangerouslySetInnerHTML={{ __html: inspection.pm_signature_data }} />
          </div>
        )}

        {/* Submit */}
        {!readOnly && (
          <Button
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
            size="lg"
            onClick={() => setShowConfirm(true)}
            disabled={!signatureData || selectedItems.size === 0}
          >
            Submit Response
          </Button>
        )}
      </div>
    </div>
  );
};

export default PMPortal;
