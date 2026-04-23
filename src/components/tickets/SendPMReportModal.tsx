import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Send } from 'lucide-react';

interface Photo { id: string; url: string; stage?: string | null }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: any;
  propertyName?: string;
  propertyAddress?: string;
  technicianName?: string;
  pmEmail?: string;
  photos: Photo[];
  lastTimelineNote?: string;
}

export default function SendPMReportModal({
  open, onOpenChange, ticket, propertyName, propertyAddress,
  technicianName, pmEmail, photos, lastTimelineNote,
}: Props) {
  const closingPhotos = photos.filter(p => p.stage === 'close' || p.stage === 'final');
  const initialSelection = closingPhotos.length > 0 ? closingPhotos : photos;

  const [subject, setSubject] = useState('');
  const [toEmail, setToEmail] = useState(pmEmail ?? '');
  const [summary, setSummary] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelection.map(p => p.id)));
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubject(`Work Completed at ${propertyName ?? 'Property'} — ${ticket?.fs_number ?? ''}`);
    setToEmail(pmEmail ?? '');
    const baseDesc = ticket?.description ?? '';
    const note = lastTimelineNote ? `\n\nWork performed:\n${lastTimelineNote}` : '';
    setSummary(`${baseDesc}${note}`.trim());
    setSelectedIds(new Set(initialSelection.map(p => p.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ticket?.id]);

  const togglePhoto = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (!toEmail.trim()) { toast.error('Recipient email required'); return; }
    if (!summary.trim()) { toast.error('Summary required'); return; }

    setSending(true);
    try {
      const photosHtml = photos
        .filter(p => selectedIds.has(p.id))
        .map(p => `<img src="${p.url}" style="max-width:100%;border-radius:6px;margin:6px 0;display:block;" />`)
        .join('');

      const { error } = await supabase.functions.invoke('send-business-email', {
        body: {
          template_name: 'ticket_pm_report',
          to_email: toEmail.trim(),
          variables: {
            fs_number: ticket?.fs_number ?? '',
            property_name: `${propertyName ?? ''}${propertyAddress ? ' · ' + propertyAddress : ''}`,
            unit: ticket?.unit ?? '—',
            work_type: (ticket?.work_type ?? '').replace('-', ' '),
            summary,
            photos_html: photosHtml ? `<h4 style="color:#FFD700;margin-top:16px;">Photos</h4>${photosHtml}` : '',
            technician_name: technicianName ?? '—',
            unsubscribe_url: '#',
          },
        },
      });

      if (error) throw error;
      toast.success('Report sent to PM');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Send Report to PM</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>To</Label>
            <Input type="email" value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="pm@example.com" />
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Property:</span> <span className="text-foreground">{propertyName ?? '—'}</span></div>
            <div><span className="text-muted-foreground">Unit:</span> <span className="text-foreground">{ticket?.unit ?? '—'}</span></div>
            <div><span className="text-muted-foreground">Work Type:</span> <span className="text-foreground capitalize">{(ticket?.work_type ?? '').replace('-', ' ')}</span></div>
            <div><span className="text-muted-foreground">Technician:</span> <span className="text-foreground">{technicianName ?? '—'}</span></div>
          </div>
          <div>
            <Label>Summary</Label>
            <Textarea value={summary} onChange={e => setSummary(e.target.value)} rows={6} />
          </div>
          {photos.length > 0 && (
            <div>
              <Label>Photos to include ({selectedIds.size}/{photos.length})</Label>
              <div className="grid grid-cols-3 gap-2 mt-2 max-h-64 overflow-y-auto">
                {photos.map(p => (
                  <label key={p.id} className="relative cursor-pointer rounded border border-border overflow-hidden">
                    <img src={p.url} alt="" className="w-full h-20 object-cover" />
                    <div className="absolute top-1 left-1 bg-background/80 rounded p-0.5">
                      <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => togglePhoto(p.id)} />
                    </div>
                    {p.stage && (
                      <span className="absolute bottom-0 left-0 right-0 text-[9px] bg-background/70 text-foreground px-1">{p.stage}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending}>
            <Send className="w-4 h-4 mr-1" /> {sending ? 'Sending…' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
