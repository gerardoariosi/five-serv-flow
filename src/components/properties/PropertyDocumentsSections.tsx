import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Download, Trash2, Image as ImageIcon, FileText, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';

const BUCKET = 'property-documents';

interface Props {
  propertyId: string;
  section?: 'gallery' | 'estimates';
}

type Kind = 'gallery' | 'estimate_invoice';

const PropertyDocumentsSections = ({ propertyId, section }: Props) => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [uploadingKind, setUploadingKind] = useState<Kind | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const { data: docs = [] } = useQuery({
    queryKey: ['property-documents', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_documents' as any)
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const gallery = docs.filter(d => d.kind === 'gallery');
  const estimates = docs.filter(d => d.kind === 'estimate_invoice');

  const uploadFile = async (kind: Kind, file: File) => {
    if (!user?.id) return;
    setUploadingKind(kind);
    try {
      let toUpload: File | Blob = file;
      if (file.type.startsWith('image/')) {
        try { toUpload = await compressImage(file); } catch { /* keep original */ }
      }
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
      const path = `${propertyId}/${kind}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, toUpload, { contentType: file.type });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from('property_documents' as any).insert({
        property_id: propertyId,
        kind,
        file_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: (toUpload as any).size ?? file.size,
        uploaded_by: user.id,
      });
      if (dbErr) throw dbErr;
      toast.success('Uploaded');
      qc.invalidateQueries({ queryKey: ['property-documents', propertyId] });
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setUploadingKind(null);
    }
  };

  const handleSelect = (kind: Kind, accept: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) uploadFile(kind, f);
    };
    input.click();
  };

  const openFile = async (doc: any) => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    else toast.error('Could not open file');
  };

  const deleteDoc = async (doc: any) => {
    if (!confirm(`Delete "${doc.file_name}"?`)) return;
    await supabase.storage.from(BUCKET).remove([doc.file_path]);
    const { error } = await supabase.from('property_documents' as any).delete().eq('id', doc.id);
    if (error) { toast.error('Delete failed'); return; }
    toast.success('Deleted');
    qc.invalidateQueries({ queryKey: ['property-documents', propertyId] });
  };

  const saveNote = async (doc: any) => {
    const next = noteDrafts[doc.id];
    if (next === undefined || next === (doc.note ?? '')) return;
    const { error } = await supabase.from('property_documents' as any).update({ note: next || null }).eq('id', doc.id);
    if (error) { toast.error('Failed to save note'); return; }
    toast.success('Note saved');
    qc.invalidateQueries({ queryKey: ['property-documents', propertyId] });
  };

  const showGallery = !section || section === 'gallery';
  const showEstimates = !section || section === 'estimates';

  return (
    <div className="space-y-4">
      {showGallery && (
      <section className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" /> Gallery
          </h2>
          <Button size="sm" variant="outline" disabled={uploadingKind === 'gallery'} onClick={() => handleSelect('gallery', 'image/*,application/pdf')}>
            <Upload className="w-4 h-4 mr-1" /> {uploadingKind === 'gallery' ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
        {gallery.length === 0 ? (
          <p className="text-xs text-muted-foreground">No photos or files yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {gallery.map(doc => (
              <GalleryTile key={doc.id} doc={doc} onOpen={() => openFile(doc)} onDelete={() => deleteDoc(doc)} />
            ))}
          </div>
        )}
      </section>
      )}

      {showEstimates && (
      <section className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" /> Estimates & Invoices
          </h2>
          <Button size="sm" variant="outline" disabled={uploadingKind === 'estimate_invoice'} onClick={() => handleSelect('estimate_invoice', 'application/pdf')}>
            <Upload className="w-4 h-4 mr-1" /> {uploadingKind === 'estimate_invoice' ? 'Uploading…' : 'Upload PDF'}
          </Button>
        </div>
        {estimates.length === 0 ? (
          <p className="text-xs text-muted-foreground">No estimates or invoices uploaded.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {estimates.map(doc => {
              const currentNote = noteDrafts[doc.id] ?? doc.note ?? '';
              return (
                <div key={doc.id} className="p-3 rounded border border-border bg-background/40">
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <button className="text-sm font-medium text-foreground hover:underline text-left truncate block w-full" onClick={() => openFile(doc)}>
                        {doc.file_name}
                      </button>
                      <p className="text-[10px] text-muted-foreground">Uploaded {new Date(doc.created_at).toLocaleDateString()}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openFile(doc)}>
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteDoc(doc)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="mt-2">
                    <Label className="text-[10px] text-muted-foreground">Note</Label>
                    <Input
                      value={currentNote}
                      placeholder="e.g. Kitchen remodel estimate — March 2026"
                      onChange={e => setNoteDrafts(p => ({ ...p, [doc.id]: e.target.value }))}
                      onBlur={() => saveNote(doc)}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      )}
    </div>
  );
};

const GalleryTile = ({ doc, onOpen, onDelete }: { doc: any; onOpen: () => void; onDelete: () => void }) => {
  const isImage = (doc.mime_type ?? '').startsWith('image/');
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage) return;
    supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 3600).then(({ data }) => {
      if (data?.signedUrl) setThumb(data.signedUrl);
    });
  }, [doc.file_path, isImage]);


  return (
    <div className="relative group aspect-square rounded-md overflow-hidden border border-border bg-muted">
      <button className="w-full h-full" onClick={onOpen}>
        {isImage && thumb ? (
          <img src={thumb} alt={doc.file_name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-2">
            <FileText className="w-6 h-6 mb-1" />
            <span className="text-[10px] text-center truncate w-full">{doc.file_name}</span>
          </div>
        )}
      </button>
      <Button size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={onDelete}>
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
};

export default PropertyDocumentsSections;
