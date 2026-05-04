import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Camera, Check, AlertTriangle, CircleDot, X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { buildAreas } from '@/lib/inspectionAreas';
import Spinner from '@/components/ui/Spinner';
import { compressImage } from '@/lib/imageCompression';

type ItemStatus = 'good' | 'needs_repair' | 'urgent';

interface AreaItemState {
  item_name: string;
  area: string;
  status: ItemStatus;
  item_note?: string;
  dbId?: string;
}

const AreaInspection = () => {
  const { user } = useAuthStore();
  const { id } = useParams();
  const navigate = useNavigate();
  const [inspection, setInspection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentAreaIndex, setCurrentAreaIndex] = useState(0);
  const [items, setItems] = useState<Record<string, AreaItemState[]>>({});
  const [photos, setPhotos] = useState<Record<string, any[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');

  const fetchData = useCallback(async () => {
    if (!id) return;
    const { data: ins } = await supabase.from('inspections').select('*').eq('id', id).single();
    if (!ins) { setLoading(false); return; }
    setInspection(ins);

    // Load existing items
    const { data: existingItems } = await supabase.from('inspection_items').select('*').eq('inspection_id', id);

    // Build areas from config
    const areas = buildAreas({
      bedrooms: ins.bedrooms ?? 1,
      bathrooms: ins.bathrooms ?? 1,
      living_rooms: ins.living_rooms ?? 1,
      has_garage: ins.has_garage ?? false,
      has_laundry: ins.has_laundry ?? false,
      has_exterior: ins.has_exterior ?? false,
    });

    // Initialize items state from existing or defaults
    const itemsMap: Record<string, AreaItemState[]> = {};
    const notesMap: Record<string, string> = {};
    for (const area of areas) {
      const areaItems: AreaItemState[] = area.items.map(item => {
        const existing = (existingItems ?? []).find((e: any) => e.area === area.key && e.item_name === item.name);
        return {
          item_name: item.name,
          area: area.key,
          status: (existing?.status as ItemStatus) ?? 'good',
          item_note: existing?.item_note ?? '',
          dbId: existing?.id,
        };
      });
      // Also add custom items from DB that aren't in defaults
      const defaultNames = new Set(area.items.map(i => i.name));
      (existingItems ?? [])
        .filter((e: any) => e.area === area.key && !defaultNames.has(e.item_name))
        .forEach((e: any) => {
          areaItems.push({
            item_name: e.item_name,
            area: area.key,
            status: (e.status as ItemStatus) ?? 'good',
            item_note: e.item_note ?? '',
            dbId: e.id,
          });
        });
      itemsMap[area.key] = areaItems;
      // Load notes from first item's note column (stored per area)
      const firstWithNote = (existingItems ?? []).find((e: any) => e.area === area.key && e.note);
      notesMap[area.key] = firstWithNote?.note ?? '';
    }
    setItems(itemsMap);
    setNotes(notesMap);

    // Load photos grouped by area from dedicated inspection_photos table
    const { data: allPhotos } = await supabase.from('inspection_photos')
      .select('*')
      .eq('inspection_id', id)
      .order('uploaded_at', { ascending: true });
    const photosMap: Record<string, any[]> = {};
    for (const p of (allPhotos ?? [])) {
      const area = p.area ?? 'other';
      if (!photosMap[area]) photosMap[area] = [];
      if (p.url) {
        const { data: signedData } = await supabase.storage.from('inspection-photos').createSignedUrl(p.url, 3600);
        photosMap[area].push({ ...p, displayUrl: signedData?.signedUrl || p.url });
      } else {
        photosMap[area].push({ ...p, displayUrl: '' });
      }
    }
    setPhotos(photosMap);

    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const areas = useMemo(() => {
    if (!inspection) return [];
    return buildAreas({
      bedrooms: inspection.bedrooms ?? 1,
      bathrooms: inspection.bathrooms ?? 1,
      living_rooms: inspection.living_rooms ?? 1,
      has_garage: inspection.has_garage ?? false,
      has_laundry: inspection.has_laundry ?? false,
      has_exterior: inspection.has_exterior ?? false,
    });
  }, [inspection]);

  const currentArea = areas[currentAreaIndex];
  const currentItems = currentArea ? (items[currentArea.key] ?? []) : [];
  const currentPhotos = currentArea ? (photos[currentArea.key] ?? []) : [];
  const currentNote = currentArea ? (notes[currentArea.key] ?? '') : '';

  const hasRepairOrUrgent = currentItems.some(i => i.status !== 'good');
  const minPhotos = hasRepairOrUrgent ? 3 : 1;
  const photosEnough = currentPhotos.length >= minPhotos;

  const setItemStatus = (index: number, status: ItemStatus) => {
    if (!currentArea) return;
    const updated = [...currentItems];
    updated[index] = { ...updated[index], status };
    // Clear item_note when switching back to good
    if (status === 'good') {
      updated[index] = { ...updated[index], status, item_note: '' };
    }
    setItems(prev => ({ ...prev, [currentArea.key]: updated }));
  };

  const setItemNote = (index: number, note: string) => {
    if (!currentArea) return;
    const updated = [...currentItems];
    updated[index] = { ...updated[index], item_note: note };
    setItems(prev => ({ ...prev, [currentArea.key]: updated }));
  };

  const autoSave = useCallback(async () => {
    if (!id || !currentArea) return;
    setSaving(true);
    for (const item of items[currentArea.key] ?? []) {
      const payload: any = {
        inspection_id: id,
        area: item.area,
        item_name: item.item_name,
        status: item.status,
        note: notes[currentArea.key] || null,
        item_note: item.item_note || null,
      };
      if (item.dbId) {
        await supabase.from('inspection_items').update(payload).eq('id', item.dbId);
      } else {
        const { data } = await supabase.from('inspection_items').insert(payload).select('id').single();
        if (data) item.dbId = data.id;
      }
    }
    // Update inspection status to in_progress
    await supabase.from('inspections').update({ status: 'in_progress' }).eq('id', id);
    setSaving(false);
  }, [id, currentArea, items, notes]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !currentArea || !id) return;
    if (!user?.id) { toast.error('Not authenticated'); return; }

    const files = Array.from(e.target.files);
    const total = files.length;
    setUploading(true);
    setUploadProgress({ current: 0, total });

    for (let i = 0; i < files.length; i++) {
      setUploadProgress({ current: i + 1, total });
      const file = await compressImage(files[i]);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `inspections/${id}/${currentArea.key}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from('inspection-photos').upload(path, file, { contentType: file.type || 'image/jpeg' });
      if (error) { toast.error(`Upload failed for ${file.name}`); continue; }
      const { error: insertError } = await supabase.from('inspection_photos').insert({
        inspection_id: id,
        area: currentArea.key,
        url: path,
        uploaded_by: user.id,
      });
      if (insertError) {
        await supabase.storage.from('inspection-photos').remove([path]);
        toast.error(`Failed to save record for ${file.name}`);
        continue;
      }
      const { data: signedData } = await supabase.storage.from('inspection-photos').createSignedUrl(path, 3600);
      setPhotos(prev => ({
        ...prev,
        [currentArea.key]: [...(prev[currentArea.key] ?? []), { url: path, displayUrl: signedData?.signedUrl || '', area: currentArea.key, id: Date.now().toString() + i }],
      }));
    }

    toast.success(`${total} photo${total > 1 ? 's' : ''} uploaded`);
    setUploading(false);
    setUploadProgress(null);
    e.target.value = '';
  };

  const handleDeletePhoto = async (photo: any) => {
    if (!currentArea) return;
    if (photo.url) {
      await supabase.storage.from('inspection-photos').remove([photo.url]);
    }
    if (photo.id) {
      await supabase.from('inspection_photos').delete().eq('id', photo.id);
    }
    setPhotos(prev => ({
      ...prev,
      [currentArea.key]: (prev[currentArea.key] ?? []).filter((p: any) => p.id !== photo.id),
    }));
    toast.success('Photo deleted');
  };

  const goNext = async () => {
    await autoSave();
    if (currentAreaIndex < areas.length - 1) {
      setCurrentAreaIndex(prev => prev + 1);
    } else {
      toast.success('Inspection complete!');
      navigate(`/inspections/${id}/pricing`);
    }
  };

  const goBack = async () => {
    await autoSave();
    if (currentAreaIndex > 0) setCurrentAreaIndex(prev => prev - 1);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>;
  if (!inspection || !currentArea) return <div className="p-4 text-muted-foreground">Inspection not found</div>;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <span className="text-xs text-muted-foreground">Area {currentAreaIndex + 1} of {areas.length}</span>
          <div className="flex gap-1 mt-1">
            {areas.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i <= currentAreaIndex ? 'bg-primary' : 'bg-border'}`} />
            ))}
          </div>
        </div>
        <div className="w-10" />
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {['Config', 'Inspect', 'Pricing', 'Sent'].map((step, i) => (
          <div key={step} className="flex items-center gap-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
              i === 1 ? 'bg-primary text-primary-foreground' : i < 1 ? 'bg-green-500 text-white' : 'bg-secondary text-muted-foreground'
            }`}>
              {i < 1 ? <Check className="w-3 h-3" /> : i + 1}
            </div>
            {i < 3 && <div className="w-4 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Area header */}
      <h2 className="text-lg font-bold text-foreground">{currentArea.label}</h2>

      {/* Items */}
      <div className="space-y-3">
        {currentItems.map((item, idx) => (
          <div key={item.item_name + idx} className="bg-card border border-border rounded-lg p-3">
            <p className="text-sm font-medium text-foreground mb-2">{item.item_name}</p>
            <div className="flex gap-2">
              {([
                { status: 'good' as const, label: 'Good', color: 'bg-green-600 hover:bg-green-700 text-white', icon: Check },
                { status: 'needs_repair' as const, label: 'Repair', color: 'bg-orange-500 hover:bg-orange-600 text-white', icon: CircleDot },
                { status: 'urgent' as const, label: 'Urgent', color: 'bg-destructive hover:bg-destructive/90 text-white', icon: AlertTriangle },
              ]).map(opt => (
                <button
                  key={opt.status}
                  onClick={() => setItemStatus(idx, opt.status)}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-md text-xs font-medium transition-all ${
                    item.status === opt.status ? opt.color : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                  }`}
                >
                  <opt.icon className="w-3 h-3" />
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Per-item note for repair/urgent */}
            {(item.status === 'needs_repair' || item.status === 'urgent') && (
              <Textarea
                value={item.item_note ?? ''}
                onChange={e => setItemNote(idx, e.target.value)}
                rows={2}
                placeholder="Describe what needs repair..."
                className="mt-2 text-sm"
                maxLength={2000}
              />
            )}
          </div>
        ))}
      </div>

      {/* Add custom item */}
      {showAddItem ? (
        <div className="flex gap-2">
          <Input
            placeholder="Item name..."
            value={newItemName}
            onChange={e => setNewItemName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newItemName.trim()) {
                setItems(prev => ({
                  ...prev,
                  [currentArea.key]: [...(prev[currentArea.key] ?? []), {
                    item_name: newItemName.trim(),
                    area: currentArea.key,
                    status: 'good' as ItemStatus,
                  }],
                }));
                setNewItemName('');
                setShowAddItem(false);
              }
            }}
            autoFocus
            className="flex-1"
          />
          <Button size="sm" onClick={() => {
            if (!newItemName.trim()) return;
            setItems(prev => ({
              ...prev,
              [currentArea.key]: [...(prev[currentArea.key] ?? []), {
                item_name: newItemName.trim(),
                area: currentArea.key,
                status: 'good' as ItemStatus,
              }],
            }));
            setNewItemName('');
            setShowAddItem(false);
          }}>Add</Button>
          <Button size="sm" variant="ghost" onClick={() => { setShowAddItem(false); setNewItemName(''); }}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAddItem(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Item
        </Button>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            Photos ({currentPhotos.length}/{minPhotos} min)
          </span>
          {!photosEnough && (
            <span className="text-xs text-destructive">Need {minPhotos - currentPhotos.length} more</span>
          )}
        </div>
        <label className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-primary/40 rounded-lg cursor-pointer hover:bg-primary/5 transition-colors">
          <Camera className="w-5 h-5 text-primary" />
          <span className="text-sm text-primary font-medium">
            {uploading && uploadProgress
              ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}...`
              : 'Add Photos'}
          </span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
        </label>
        {currentPhotos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {currentPhotos.map((p: any, i: number) => (
              <div key={p.id ?? i} className="relative rounded-lg overflow-hidden border border-border group">
                <img src={p.displayUrl || p.url} alt="" className="w-full h-20 object-cover" />
                <button
                  onClick={() => handleDeletePhoto(p)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete photo"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <span className="text-sm font-medium text-foreground">Area Notes (optional)</span>
        <Textarea
          value={currentNote}
          onChange={e => {
            if (e.target.value.length <= 5000) {
              setNotes(prev => ({ ...prev, [currentArea.key]: e.target.value }));
            }
          }}
          rows={2}
          placeholder="Add notes for this area..."
          className="mt-1"
        />
        <span className="text-[10px] text-muted-foreground">{currentNote.length}/5000</span>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1" onClick={goBack} disabled={currentAreaIndex === 0 || saving || uploading}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button className="flex-1" onClick={goNext} disabled={!photosEnough || saving || uploading}>
          {saving ? <Spinner size="sm" /> : currentAreaIndex === areas.length - 1 ? (
            <>Finish <Check className="w-4 h-4 ml-1" /></>
          ) : (
            <>Next <ArrowRight className="w-4 h-4 ml-1" /></>
          )}
        </Button>
      </div>
    </div>
  );
};

export default AreaInspection;
