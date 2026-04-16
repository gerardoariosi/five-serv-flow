import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Edit, Trash2, Eye, ExternalLink, Clock, Check, FileText, AlertTriangle, Link2, ArrowRight, Download, Mail, Send } from 'lucide-react';
import { inspectionStatusLabels, inspectionStatusColors } from '@/lib/inspectionColors';
import Spinner from '@/components/ui/Spinner';
import { generateFiveServPdf, generatePmVersionPdf, downloadPdf } from '@/lib/inspectionPdf';

const InspectionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeRole, user } = useAuthStore();
  const [inspection, setInspection] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<any[]>([]);
  const [linkedTickets, setLinkedTickets] = useState<any[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [properties, setProperties] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<Record<string, string>>({});

  // Convert modal
  const [showConvert, setShowConvert] = useState(false);
  const [selectedForTicket, setSelectedForTicket] = useState<Set<string>>(new Set());
  const [converting, setConverting] = useState(false);

  // Delete confirm
  const [showDelete, setShowDelete] = useState(false);

  // Email modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailType, setEmailType] = useState<'fiveserv' | 'pm'>('fiveserv');
  const [emailTo, setEmailTo] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [insRes, itemsRes, photosRes, ticketLinksRes, cRes, pRes, uRes] = await Promise.all([
      supabase.from('inspections').select('*').eq('id', id).single(),
      supabase.from('inspection_items').select('*').eq('inspection_id', id).order('area'),
      supabase.from('inspection_photos').select('*').eq('inspection_id', id).order('uploaded_at', { ascending: true }).then(async (res) => {
        const photosWithUrls = [];
        for (const p of (res.data ?? [])) {
          if (p.url && !p.url.startsWith('http')) {
            const { data: signedData } = await supabase.storage.from('inspection-photos').createSignedUrl(p.url, 3600);
            photosWithUrls.push({ ...p, displayUrl: signedData?.signedUrl || p.url });
          } else {
            photosWithUrls.push({ ...p, displayUrl: p.url });
          }
        }
        return { data: photosWithUrls };
      }),
      supabase.from('inspection_tickets').select('*, tickets(*)').eq('inspection_id', id),
      supabase.from('clients').select('id, company_name'),
      supabase.from('properties').select('id, name'),
      supabase.rpc('get_user_directory'),
    ]);
    setInspection(insRes.data);
    setItems(itemsRes.data ?? []);
    setPhotos(photosRes.data ?? []);
    setLinkedTickets((ticketLinksRes.data ?? []).map((l: any) => l.tickets).filter(Boolean));

    const cMap: Record<string, string> = {};
    (cRes.data ?? []).forEach((c: any) => { cMap[c.id] = c.company_name ?? ''; });
    setClients(cMap);
    const pMap: Record<string, string> = {};
    (pRes.data ?? []).forEach((p: any) => { pMap[p.id] = p.name ?? ''; });
    setProperties(pMap);
    const uMap: Record<string, string> = {};
    (uRes.data ?? []).forEach((u: any) => { uMap[u.id] = u.full_name ?? ''; });
    setUsers(uMap);

    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-activate scheduled inspections when their date has arrived
  useEffect(() => {
    if (!inspection || inspection.status !== 'scheduled') return;
    const visit = inspection.visit_date ? new Date(inspection.visit_date) : null;
    if (!visit) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (visit <= today) {
      supabase.from('inspections').update({ status: 'draft' }).eq('id', id).then(() => fetchData());
    }
  }, [inspection, id, fetchData]);

  const handleDeleteInspection = async () => {
    await supabase.from('inspection_items').delete().eq('inspection_id', id);
    await supabase.from('inspection_photos').delete().eq('inspection_id', id);
    await supabase.from('inspection_tickets').delete().eq('inspection_id', id);
    await supabase.from('inspections').delete().eq('id', id);
    toast.success('Inspection deleted');
    navigate('/inspections');
  };

  const handleMarkApproved = async () => {
    await supabase.from('inspections').update({ status: 'estimate_approved' }).eq('id', id);
    toast.success('Estimate approved');
    fetchData();
  };

  const handleConvertToTickets = async () => {
    if (selectedForTicket.size === 0) { toast.error('Select at least one item'); return; }
    setConverting(true);

    const selected = items.filter(i => selectedForTicket.has(i.id));

    // Build description grouped by area — clean readable format, no prices
    const byArea: Record<string, any[]> = {};
    selected.forEach(i => {
      const area = i.area ?? 'other';
      if (!byArea[area]) byArea[area] = [];
      byArea[area].push(i);
    });

    const hasUrgent = selected.some(i => i.status === 'urgent');
    const workType = hasUrgent ? 'emergency' : 'repair';
    const priority = hasUrgent ? 'high' : 'normal';

    const descParts: string[] = [];
    descParts.push(`### Work from Inspection #${inspection.ins_number ?? ''}`.trim());
    descParts.push('');
    for (const [area, areaItems] of Object.entries(byArea)) {
      descParts.push(`AREA: ${area.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`);
      areaItems.forEach((i: any) => {
        const urgent = i.status === 'urgent' ? ' (URGENT)' : '';
        const notes: string[] = [];
        if (i.item_note) notes.push(`Tech: ${i.item_note}`);
        if (i.pm_note) notes.push(`PM: ${i.pm_note}`);
        const noteStr = notes.length ? ` — ${notes.join(' / ')}` : '';
        descParts.push(`• ${i.item_name}${urgent}${noteStr}`);
      });
      descParts.push('');
    }

    // Internal note with PM approved total
    const pmTotal = inspection.pm_total_selected ?? 0;
    const internalNote = pmTotal > 0 ? `PM approved total: $${pmTotal.toFixed(2)}` : null;

    const { data: fsNumber } = await supabase.rpc('generate_fs_number');
    const { data: ticket } = await supabase.from('tickets').insert({
      fs_number: fsNumber as string,
      client_id: inspection.client_id,
      property_id: inspection.property_id,
      status: 'open',
      work_type: workType,
      priority,
      description: descParts.join('\n').trim(),
      internal_note: internalNote,
      related_inspection_id: id,
    }).select('id').single();

    if (ticket) {
      await supabase.from('inspection_tickets').insert({
        inspection_id: id,
        ticket_id: ticket.id,
      });
    }

    await supabase.from('inspections').update({ status: 'converted' }).eq('id', id);
    setShowConvert(false);
    toast.success('Ticket created from inspection');
    fetchData();
    setConverting(false);
  };

  // PDF Export handlers
  const handleExportFiveServ = () => {
    const doc = generateFiveServPdf({ inspection, items, photos, clients, properties });
    downloadPdf(doc, `${inspection.ins_number ?? 'inspection'}-fiveserv-report.pdf`);
    toast.success('FiveServ PDF downloaded');
  };

  const handleExportPm = () => {
    const doc = generatePmVersionPdf({ inspection, items, photos, clients, properties });
    downloadPdf(doc, `${inspection.ins_number ?? 'inspection'}-pm-report.pdf`);
    toast.success('PM Version PDF downloaded');
  };

  const handleOpenEmailModal = (type: 'fiveserv' | 'pm') => {
    setEmailType(type);
    setEmailTo('');
    setShowEmailModal(true);
  };

  const handleSendEmail = async () => {
    if (!emailTo.trim()) { toast.error('Enter an email address'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTo.trim())) { toast.error('Enter a valid email address'); return; }

    setSendingEmail(true);
    try {
      const doc = emailType === 'fiveserv'
        ? generateFiveServPdf({ inspection, items, photos, clients, properties })
        : generatePmVersionPdf({ inspection, items, photos, clients, properties });

      const reportType = emailType === 'fiveserv' ? 'FiveServ Internal Report' : 'PM Version Report';
      const propertyName = inspection.property_id ? properties[inspection.property_id] ?? '' : '';
      const filename = `${inspection.ins_number ?? 'inspection'}-${emailType === 'fiveserv' ? 'fiveserv' : 'pm'}-report.pdf`;

      // Convert PDF to blob and upload to storage
      const pdfBlob = doc.output('blob');
      const storagePath = `reports/${inspection.id}/${Date.now()}-${filename}`;
      const { error: uploadError } = await supabase.storage
        .from('inspection-reports')
        .upload(storagePath, pdfBlob, { contentType: 'application/pdf' });

      if (uploadError) throw new Error('Failed to upload PDF: ' + uploadError.message);

      // Get public URL for the download link
      const { data: urlData } = supabase.storage
        .from('inspection-reports')
        .getPublicUrl(storagePath);

      const downloadUrl = urlData?.publicUrl;
      if (!downloadUrl) throw new Error('Failed to generate download URL');

      // Send via transactional email with download link
      const { error } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'inspection-report',
          recipientEmail: emailTo.trim(),
          idempotencyKey: `inspection-report-${inspection.id}-${emailType}-${Date.now()}`,
          templateData: {
            ins_number: inspection.ins_number ?? '',
            property_name: propertyName,
            report_type: reportType,
            visit_date: inspection.visit_date ?? 'N/A',
            download_url: downloadUrl,
          },
        },
      });

      if (error) throw error;
      toast.success(`Report sent to ${emailTo.trim()}`);
      setShowEmailModal(false);
    } catch (err: any) {
      console.error('Failed to send email:', err);
      toast.error('Failed to send email. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  const portalUrl = inspection?.pm_link_token
    ? `${window.location.origin}/portal/${inspection.pm_link_token}`
    : null;

  const daysSinceSent = inspection?.status === 'sent' && !inspection?.pm_submitted_at
    ? Math.floor((Date.now() - new Date(inspection.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const closedTickets = linkedTickets.filter((t: any) => t.status === 'closed').length;

  // Group photos by area
  const photosByArea: Record<string, any[]> = {};
  photos.forEach((p: any) => {
    const area = p.area ?? 'other';
    if (!photosByArea[area]) photosByArea[area] = [];
    photosByArea[area].push(p);
  });

  // Group items by area
  const itemsByArea: Record<string, any[]> = {};
  items.forEach(i => {
    const area = i.area ?? 'other';
    if (!itemsByArea[area]) itemsByArea[area] = [];
    itemsByArea[area].push(i);
  });

  // PM selected items
  const pmSelected = items.filter(i => i.pm_selected);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>;
  if (!inspection) return <div className="p-4 text-muted-foreground">Inspection not found</div>;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-5">
      {/* Delete confirm */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{inspection.status === 'draft' ? 'Delete Draft?' : 'Delete Inspection?'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {inspection.status === 'draft'
              ? 'This will permanently delete this inspection draft and all its items.'
              : 'This inspection has been sent to PM. Are you sure you want to delete it? This action cannot be undone.'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteInspection}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert modal */}
      <Dialog open={showConvert} onOpenChange={(open) => {
        setShowConvert(open);
        // Pre-select PM-selected items when opening
        if (open) {
          const pmIds = new Set(items.filter(i => i.pm_selected).map(i => i.id));
          // Fall back to all non-good items if no PM selection
          setSelectedForTicket(pmIds.size > 0 ? pmIds : new Set(items.filter(i => i.status !== 'good').map(i => i.id)));
        }
      }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Convert to Ticket</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground mb-3">Select items to include in the new ticket. PM-approved items are pre-selected.</p>
          <div className="space-y-2">
            {items.filter(i => i.status !== 'good').map(item => (
              <label key={item.id} className="flex items-start gap-2 p-2 rounded-md hover:bg-secondary cursor-pointer">
                <Checkbox
                  checked={selectedForTicket.has(item.id)}
                  onCheckedChange={() => {
                    setSelectedForTicket(prev => {
                      const next = new Set(prev);
                      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                      return next;
                    });
                  }}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-foreground">{item.item_name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.pm_selected && (
                        <Badge className="text-[10px] bg-green-500/20 text-green-400">PM ✓</Badge>
                      )}
                      <Badge className={`text-[10px] ${item.status === 'urgent' ? 'bg-destructive text-destructive-foreground' : 'bg-orange-500 text-white'}`}>
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                  {item.item_note && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">Tech: {item.item_note}</p>
                  )}
                  {item.pm_note && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">PM: {item.pm_note}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
          {inspection.pm_total_selected != null && inspection.pm_total_selected > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">PM Approved Total</span>
              <span className="text-sm font-bold text-primary">${inspection.pm_total_selected.toFixed(2)}</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvert(false)}>Cancel</Button>
            <Button onClick={handleConvertToTickets} disabled={converting || selectedForTicket.size === 0}>
              {converting ? <Spinner size="sm" /> : 'Create Ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email modal */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Send {emailType === 'fiveserv' ? 'FiveServ' : 'PM'} Report by Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="email-to">Recipient Email</Label>
              <Input
                id="email-to"
                type="email"
                placeholder="Enter email address"
                value={emailTo}
                onChange={e => setEmailTo(e.target.value)}
                className="mt-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The {emailType === 'fiveserv' ? 'FiveServ internal' : 'PM version'} PDF report will be attached to the email.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailModal(false)} disabled={sendingEmail}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={sendingEmail || !emailTo.trim()}>
              {sendingEmail ? <Spinner size="sm" /> : <><Send className="w-4 h-4 mr-1" /> Send</>}
            </Button>
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
            <span className="font-mono text-lg font-bold text-foreground">{inspection.ins_number ?? 'No INS#'}</span>
            <Badge className={`text-xs ${inspectionStatusColors[inspection.status ?? 'draft']}`}>
              {inspectionStatusLabels[inspection.status ?? 'draft']}
            </Badge>
          </div>
        </div>
      </div>

      {/* PM not responding alert */}
      {inspection.status === 'sent' && !inspection.pm_submitted_at && daysSinceSent >= 2 && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          <span className="text-sm text-yellow-400 font-medium">PM hasn't responded in {daysSinceSent} days</span>
        </div>
      )}

      {/* Info */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Property</span>
            <p className="text-foreground font-medium">{inspection.property_id ? properties[inspection.property_id] : '—'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Client / PM</span>
            <p className="text-foreground font-medium">{inspection.client_id ? clients[inspection.client_id] : '—'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Visit Date</span>
            <p className="text-foreground font-medium">{inspection.visit_date ?? '—'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Config</span>
            <p className="text-foreground font-medium text-xs">
              {inspection.bedrooms}BR · {inspection.bathrooms}BA · {inspection.living_rooms}LR
              {inspection.has_garage ? ' · Garage' : ''}
              {inspection.has_laundry ? ' · Laundry' : ''}
              {inspection.has_exterior ? ' · Exterior' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Export & Email buttons */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" /> Export & Share
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-2">
            <Button size="sm" variant="outline" className="w-full justify-start" onClick={handleExportFiveServ}>
              <Download className="w-4 h-4 mr-2" /> Export FiveServ PDF
            </Button>
            <Button size="sm" variant="ghost" className="w-full justify-start text-muted-foreground" onClick={() => handleOpenEmailModal('fiveserv')}>
              <Mail className="w-4 h-4 mr-2" /> Send FiveServ by Email
            </Button>
          </div>
          <div className="space-y-2">
            <Button size="sm" variant="outline" className="w-full justify-start" onClick={handleExportPm}>
              <Download className="w-4 h-4 mr-2" /> Export PM Version PDF
            </Button>
            <Button size="sm" variant="ghost" className="w-full justify-start text-muted-foreground" onClick={() => handleOpenEmailModal('pm')}>
              <Mail className="w-4 h-4 mr-2" /> Send PM Version by Email
            </Button>
          </div>
        </div>
      </div>

      {/* Action buttons by status */}
      <div className="flex gap-2 flex-wrap">
        {inspection.status === 'draft' && (
          <Button size="sm" onClick={() => navigate(`/inspections/${id}/inspect`)}>
            <ArrowRight className="w-4 h-4 mr-1" /> Continue Inspection
          </Button>
        )}
        {(activeRole === 'admin' || activeRole === 'supervisor') && (
          <Button size="sm" variant="destructive" onClick={() => setShowDelete(true)}>
            <Trash2 className="w-4 h-4 mr-1" /> {inspection.status === 'draft' ? 'Delete Draft' : 'Delete Inspection'}
          </Button>
        )}
        {inspection.status === 'sent' && portalUrl && (
          <>
            <Button size="sm" variant="outline" onClick={() => window.open(portalUrl, '_blank')}>
              <ExternalLink className="w-4 h-4 mr-1" /> View PM Portal
            </Button>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Eye className="w-3 h-3" /> Opened {inspection.link_opened_count ?? 0} times
            </div>
          </>
        )}
        {inspection.status === 'pm_responded' && (
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleMarkApproved}>
            <Check className="w-4 h-4 mr-1" /> Mark Estimate Approved
          </Button>
        )}
        {inspection.status === 'estimate_approved' && (
          <Button size="sm" onClick={() => setShowConvert(true)}>
            <Link2 className="w-4 h-4 mr-1" /> Convert to Ticket(s)
          </Button>
        )}
        {inspection.status === 'converted' && linkedTickets.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Progress: {closedTickets} of {linkedTickets.length} tickets closed
          </div>
        )}
      </div>

      {/* Linked tickets */}
      {linkedTickets.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Linked Tickets</h3>
          {linkedTickets.map((t: any) => (
            <button key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-foreground">{t.fs_number}</span>
                <Badge className="text-[10px]">{t.status}</Badge>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="fiveserv">
        <TabsList className="w-full">
          <TabsTrigger value="fiveserv" className="flex-1">FiveServ View</TabsTrigger>
          {inspection.pm_submitted_at && (
            <TabsTrigger value="pm" className="flex-1">PM Response</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="fiveserv" className="space-y-4 mt-4">
          {/* Items by area */}
          {Object.entries(itemsByArea).map(([area, areaItems]) => (
            <div key={area}>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{area.replace(/_/g, ' ')}</h4>
              <div className="space-y-1">
                {areaItems.map((item: any) => (
                  <div key={item.id} className="py-1.5 px-2 rounded-md bg-card">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{item.item_name}</span>
                      <Badge className={`text-[10px] ${
                        item.status === 'good' ? 'bg-green-500/20 text-green-400' :
                        item.status === 'urgent' ? 'bg-destructive/20 text-destructive' :
                        'bg-orange-500/20 text-orange-400'
                      }`}>
                        {item.status === 'good' ? 'Good' : item.status === 'urgent' ? 'Urgent' : 'Needs Repair'}
                      </Badge>
                    </div>
                    {item.item_note && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic pl-1">→ {item.item_note}</p>
                    )}
                  </div>
                ))}
              </div>
              {/* Area technician note */}
              {(() => {
                const areaNote = areaItems.find((i: any) => i.note)?.note;
                return areaNote ? (
                  <div className="mt-2 px-2 py-1.5 rounded-md bg-secondary/50 border border-border">
                    <p className="text-xs text-muted-foreground font-medium mb-0.5">Technician Note</p>
                    <p className="text-sm text-foreground">{areaNote}</p>
                  </div>
                ) : null;
              })()}
              {/* Area photos */}
              {photosByArea[area] && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {photosByArea[area].map((p: any) => (
                    <div key={p.id} className="rounded-lg overflow-hidden border border-border">
                      <img src={p.displayUrl || p.url} alt="" className="w-full h-28 object-cover" />
                      <div className="p-1">
                        <p className="text-[9px] text-muted-foreground">
                          {new Date(p.uploaded_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </TabsContent>

        {inspection.pm_submitted_at && (
          <TabsContent value="pm" className="space-y-4 mt-4">
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Submitted</span>
                  <p className="text-foreground font-medium text-xs">
                    {new Date(inspection.pm_submitted_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Pre-Approved Total</span>
                  <p className="text-primary font-bold">${(inspection.pm_total_selected ?? 0).toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* PM selected items */}
            <h4 className="text-sm font-semibold text-foreground">Selected Items</h4>
            {pmSelected.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items selected by PM</p>
            ) : (
              pmSelected.map((item: any) => (
                <div key={item.id} className="bg-card border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{item.item_name}</span>
                    <span className="text-sm font-bold text-primary">${((item.quantity ?? 1) * (item.unit_price ?? 0)).toFixed(2)}</span>
                  </div>
                  {item.area && <p className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-wider">{String(item.area).replace(/_/g, ' ')}</p>}
                  {item.item_note && <p className="text-xs text-muted-foreground mt-1"><span className="font-semibold">Tech:</span> <span className="italic">{item.item_note}</span></p>}
                  {item.pm_note && <p className="text-xs text-muted-foreground mt-1"><span className="font-semibold">PM:</span> <span className="italic">"{item.pm_note}"</span></p>}
                </div>
              ))
            )}

            {/* General note */}
            {(inspection as any).pm_general_note && (
              <div className="bg-card border border-border rounded-lg p-3">
                <h4 className="text-sm font-semibold text-foreground mb-1">PM General Note</h4>
                <p className="text-sm text-muted-foreground italic">"{(inspection as any).pm_general_note}"</p>
              </div>
            )}

            {/* Signature */}
            {inspection.pm_signature_data && (
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Signature</h4>
                <div className="border border-border rounded-lg p-3 bg-white" dangerouslySetInnerHTML={{ __html: inspection.pm_signature_data }} />
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default InspectionDetail;
