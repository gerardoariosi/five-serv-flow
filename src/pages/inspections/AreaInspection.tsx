import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Camera, Check, AlertTriangle, CircleDot, X } from 'lucide-react';
import { buildAreas } from '@/lib/inspectionAreas';
import Spinner from '@/components/ui/Spinner';

type ItemStatus = 'good' | 'needs_repair' | 'urgent';

interface AreaItemState {
  item_name: string;
  area: string;
  status: ItemStatus;
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
          dbId: existing?.id,
        };
      });
      itemsMap[area.key] = areaItems;
      // Load notes from first item's pm_note (stored per area)
      const firstWithNote = (existingItems ?? []).find((e: any) => e.area === area.key && e.pm_note);
      notesMap[area.key] = firstWithNote?.pm_note ?? '';
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
    setItems(prev => ({ ...prev, [currentArea.key]: updated }));
  };

  const autoSave = useCallback(async () => {
    if (!id || !currentArea) return;
    setSaving(true);
    for (const item of items[currentArea.key] ?? []) {
      const payload = {
        inspection_id: id,
        area: item.area,
        item_name: item.item_name,
        status: item.status,
        pm_note: notes[currentArea.key] || null,
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
    setUploading(true);
    if (!user?.id) { toast.error('Not authenticated'); setUploading(false); return; }
    const file = e.target.files[0];
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `inspections/${id}/${currentArea.key}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from('inspection-photos').upload(path, file, { contentType: file.type || 'image/jpeg' });
    if (error) { toast.error('Upload failed: ' + error.message); setUploading(false); return; }
    const { error: insertError } = await supabase.from('inspection_photos').insert({
      inspection_id: id,
      area: currentArea.key,
      url: path,
      uploaded_by: user.id,
    });
    if (insertError) {
      // Cleanup orphaned file
      await supabase.storage.from('inspection-photos').remove([path]);
      toast.error('Failed to save photo record: ' + insertError.message);
      setUploading(false);
      return;
    }
    const { data: signedData } = await supabase.storage.from('inspection-photos').createSignedUrl(path, 3600);
    setPhotos(prev => ({
      ...prev,
      [currentArea.key]: [...(prev[currentArea.key] ?? []), { url: path, displayUrl: signedData?.signedUrl || '', area: currentArea.key, id: Date.now().toString() }],
    }));
    toast.success('Photo uploaded');
    setUploading(false);
    e.target.value = '';
  };

  const handleDeletePhoto = async (photo: any) => {
    if (!currentArea) return;
    // Delete from storage
    if (photo.url) {
      await supabase.storage.from('inspection-photos').remove([photo.url]);
    }
    // Delete from DB
    if (photo.id) {
      await supabase.from('inspection_photos').delete().eq('id', photo.id);
    }
    // Update local state
    setPhotos(prev => ({
      ...prev,
      [currentArea.key]: (prev[currentArea.key] ?? []).filter((p: any) => p.id !== photo.id),
    }));
    toast.success('Photo deleted');
  };

    await autoSave();
    if (currentAreaIndex < areas.length - 1) {
      setCurrentAreaIndex(prev => prev + 1);
    } else {
      // All areas done → go to pricing
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
          <div key={item.item_name} className="bg-card border border-border rounded-lg p-3">
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
          </div>
        ))}
      </div>

      {/* Photos */}
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
          <span className="text-sm text-primary font-medium">{uploading ? 'Uploading...' : 'Add Photo'}</span>
          <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
        </label>
        {currentPhotos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {currentPhotos.map((p: any, i: number) => (
              <div key={p.id ?? i} className="rounded-lg overflow-hidden border border-border">
                <img src={p.displayUrl || p.url} alt="" className="w-full h-20 object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <span className="text-sm font-medium text-foreground">Notes (optional)</span>
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
        <Button variant="outline" className="flex-1" onClick={goBack} disabled={currentAreaIndex === 0 || saving}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button className="flex-1" onClick={goNext} disabled={!photosEnough || saving}>
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
