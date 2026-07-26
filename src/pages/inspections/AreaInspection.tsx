import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Camera, Check, AlertTriangle, CircleDot, X, Plus, MinusCircle, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { buildAreas } from '@/lib/inspectionAreas';
import Spinner from '@/components/ui/Spinner';
import { compressImage } from '@/lib/imageCompression';
import PhotoMarkerDialog from '@/components/inspections/PhotoMarkerDialog';

type ItemStatus = 'good' | 'needs_repair' | 'urgent' | 'na';
type ItemPriority = 'low' | 'medium' | 'high' | null;

interface AreaItemState {
  item_name: string;
  area: string;
  status: ItemStatus;
  item_note?: string;
  priority?: ItemPriority;
  dbId?: string;
}

interface PhotoRec {
  id?: string;
  url: string;
  displayUrl: string;
  area: string;
  item_id?: string | null;
  marker_x?: number | null;
  marker_y?: number | null;
  marker_note?: string | null;
}

const statusLabelMap: Record<ItemStatus, string> = {
  good: 'Good', needs_repair: 'Repair', urgent: 'Urgent', na: 'N/A',
};

const AreaInspection = () => {
  const { user } = useAuthStore();
  const { id } = useParams();
  const navigate = useNavigate();
  const [inspection, setInspection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentAreaIndex, setCurrentAreaIndex] = useState(0);
  const [items, setItems] = useState<Record<string, AreaItemState[]>>({});
  const [photos, setPhotos] = useState<Record<string, PhotoRec[]>>({}); // area-level (item_id null)
  const [itemPhotos, setItemPhotos] = useState<Record<string, PhotoRec[]>>({}); // key = item dbId
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [priorItems, setPriorItems] = useState<Record<string, { status: string; item_note: string | null; date: string }>>({});
  const [expandedPrior, setExpandedPrior] = useState<Record<string, boolean>>({});
  const [markerPhoto, setMarkerPhoto] = useState<PhotoRec | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const { data: ins } = await supabase.from('inspections').select('*').eq('id', id).single();
    if (!ins) { setLoading(false); return; }
    setInspection(ins);

    const { data: existingItems } = await supabase.from('inspection_items').select('*').eq('inspection_id', id);

    const areas = buildAreas({
      bedrooms: ins.bedrooms ?? 1,
      bathrooms: ins.bathrooms ?? 1,
      living_rooms: ins.living_rooms ?? 1,
      has_garage: ins.has_garage ?? false,
      has_laundry: ins.has_laundry ?? false,
      has_exterior: ins.has_exterior ?? false,
    });

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
          priority: (existing?.priority as ItemPriority) ?? null,
          dbId: existing?.id,
        };
      });
      const defaultNames = new Set(area.items.map(i => i.name));
      (existingItems ?? [])
        .filter((e: any) => e.area === area.key && !defaultNames.has(e.item_name))
        .forEach((e: any) => {
          areaItems.push({
            item_name: e.item_name,
            area: area.key,
            status: (e.status as ItemStatus) ?? 'good',
            item_note: e.item_note ?? '',
            priority: (e.priority as ItemPriority) ?? null,
            dbId: e.id,
          });
        });
      itemsMap[area.key] = areaItems;
      const firstWithNote = (existingItems ?? []).find((e: any) => e.area === area.key && e.note);
      notesMap[area.key] = firstWithNote?.note ?? '';
    }
    setItems(itemsMap);
    setNotes(notesMap);

    const { data: allPhotos } = await supabase.from('inspection_photos')
      .select('*')
      .eq('inspection_id', id)
      .order('uploaded_at', { ascending: true });
    const areaPhotoMap: Record<string, PhotoRec[]> = {};
    const itemPhotoMap: Record<string, PhotoRec[]> = {};
    for (const p of (allPhotos ?? [])) {
      const area = p.area ?? 'other';
      let displayUrl = '';
      if (p.url) {
        const { data: signedData } = await supabase.storage.from('inspection-photos').createSignedUrl(p.url, 3600);
        displayUrl = signedData?.signedUrl || '';
      }
      const rec: PhotoRec = { ...p, displayUrl, area };
      if (p.item_id) {
        if (!itemPhotoMap[p.item_id]) itemPhotoMap[p.item_id] = [];
        itemPhotoMap[p.item_id].push(rec);
      } else {
        if (!areaPhotoMap[area]) areaPhotoMap[area] = [];
        areaPhotoMap[area].push(rec);
      }
    }
    setPhotos(areaPhotoMap);
    setItemPhotos(itemPhotoMap);

    // Prior inspection reference — most recent completed inspection for same property
    if (ins.property_id) {
      const { data: prior } = await supabase.from('inspections')
        .select('id, created_at')
        .eq('property_id', ins.property_id)
        .neq('id', id)
        .in('status', ['complete', 'converted', 'closed_internally', 'sent', 'pm_responded', 'estimate_approved'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prior?.id) {
        const { data: priorItemsData } = await supabase.from('inspection_items')
          .select('item_name, status, item_note')
          .eq('inspection_id', prior.id);
        const map: Record<string, { status: string; item_note: string | null; date: string }> = {};
        for (const pi of (priorItemsData ?? [])) {
          map[pi.item_name] = { status: pi.status, item_note: pi.item_note, date: prior.created_at };
        }
        setPriorItems(map);
      }
    }

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

  const hasRepairOrUrgent = currentItems.some(i => i.status === 'needs_repair' || i.status === 'urgent');
  const minPhotos = hasRepairOrUrgent ? 3 : 1;
  const photosEnough = currentPhotos.length >= minPhotos;
  // Per-item photos are optional now.
  const itemPhotoReq = true;
  const unsavedRepair = false;

  const setItemStatus = (index: number, status: ItemStatus) => {
    if (!currentArea) return;
    const updated = [...currentItems];
    const curr = updated[index];
    if (status === 'good' || status === 'na') {
      updated[index] = { ...curr, status, item_note: '', priority: null };
    } else {
      updated[index] = { ...curr, status, priority: curr.priority ?? 'medium' };
    }
    setItems(prev => ({ ...prev, [currentArea.key]: updated }));
    // Auto-save so the item gets a dbId and the user can optionally add a photo.
    if (status === 'needs_repair' || status === 'urgent') {
      setTimeout(() => { autoSaveRef.current?.(); }, 0);
    }
  };

  const setItemNote = (index: number, note: string) => {
    if (!currentArea) return;
    const updated = [...currentItems];
    updated[index] = { ...updated[index], item_note: note };
    setItems(prev => ({ ...prev, [currentArea.key]: updated }));
  };

  const setItemPriority = (index: number, priority: ItemPriority) => {
    if (!currentArea) return;
    const updated = [...currentItems];
    updated[index] = { ...updated[index], priority };
    setItems(prev => ({ ...prev, [currentArea.key]: updated }));
  };

  const autoSave = useCallback(async () => {
    if (!id || !currentArea) return;
    setSaving(true);
    const list = items[currentArea.key] ?? [];
    for (const item of list) {
      const payload: any = {
        inspection_id: id,
        area: item.area,
        item_name: item.item_name,
        status: item.status,
        note: notes[currentArea.key] || null,
        item_note: item.item_note || null,
        priority: item.priority ?? null,
      };
      if (item.dbId) {
        await supabase.from('inspection_items').update(payload).eq('id', item.dbId);
      } else {
        const { data } = await supabase.from('inspection_items').insert(payload).select('id').single();
        if (data) item.dbId = data.id;
      }
    }
    setItems(prev => ({ ...prev, [currentArea.key]: [...list] }));
    await supabase.from('inspections').update({ status: 'in_progress' }).eq('id', id);
    setSaving(false);
  }, [id, currentArea, items, notes]);

  const autoSaveRef = useRef(autoSave);
  useEffect(() => { autoSaveRef.current = autoSave; }, [autoSave]);

  const handleAreaPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !currentArea || !id) return;
    if (!user?.id) { toast.error('Not authenticated'); return; }
    const files = Array.from(e.target.files);
    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    for (let i = 0; i < files.length; i++) {
      setUploadProgress({ current: i + 1, total: files.length });
      const file = await compressImage(files[i]);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `inspections/${id}/${currentArea.key}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from('inspection-photos').upload(path, file, { contentType: file.type || 'image/jpeg' });
      if (error) { toast.error(`Upload failed for ${file.name}`); continue; }
      const { data: inserted, error: insertError } = await supabase.from('inspection_photos').insert({
        inspection_id: id, area: currentArea.key, url: path, uploaded_by: user.id,
      }).select('*').single();
      if (insertError || !inserted) {
        await supabase.storage.from('inspection-photos').remove([path]);
        toast.error(`Failed to save record`);
        continue;
      }
      const { data: signedData } = await supabase.storage.from('inspection-photos').createSignedUrl(path, 3600);
      const rec: PhotoRec = { ...inserted, area: currentArea.key, displayUrl: signedData?.signedUrl || '' };
      setPhotos(prev => ({ ...prev, [currentArea.key]: [...(prev[currentArea.key] ?? []), rec] }));
    }
    toast.success(`${files.length} photo${files.length > 1 ? 's' : ''} uploaded`);
    setUploading(false);
    setUploadProgress(null);
    e.target.value = '';
  };

  const handleItemPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, item: AreaItemState) => {
    if (!e.target.files?.length || !currentArea || !id || !item.dbId) return;
    if (!user?.id) { toast.error('Not authenticated'); return; }
    const files = Array.from(e.target.files);
    setUploading(true);
    for (const raw of files) {
      const file = await compressImage(raw);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `inspections/${id}/${currentArea.key}/items/${item.dbId}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from('inspection-photos').upload(path, file, { contentType: file.type || 'image/jpeg' });
      if (error) { toast.error(`Upload failed`); continue; }
      const { data: inserted, error: insertError } = await supabase.from('inspection_photos').insert({
        inspection_id: id, area: currentArea.key, item_id: item.dbId, url: path, uploaded_by: user.id,
      }).select('*').single();
      if (insertError || !inserted) {
        await supabase.storage.from('inspection-photos').remove([path]);
        toast.error(`Failed to save record`);
        continue;
      }
      const { data: signedData } = await supabase.storage.from('inspection-photos').createSignedUrl(path, 3600);
      const rec: PhotoRec = { ...inserted, area: currentArea.key, displayUrl: signedData?.signedUrl || '' };
      setItemPhotos(prev => ({ ...prev, [item.dbId!]: [...(prev[item.dbId!] ?? []), rec] }));
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleDeletePhoto = async (photo: PhotoRec, itemId?: string) => {
    if (photo.url) await supabase.storage.from('inspection-photos').remove([photo.url]);
    if (photo.id) await supabase.from('inspection_photos').delete().eq('id', photo.id);
    if (itemId) {
      setItemPhotos(prev => ({ ...prev, [itemId]: (prev[itemId] ?? []).filter(p => p.id !== photo.id) }));
    } else if (currentArea) {
      setPhotos(prev => ({ ...prev, [currentArea.key]: (prev[currentArea.key] ?? []).filter(p => p.id !== photo.id) }));
    }
    toast.success('Photo deleted');
  };

  const handleSaveMarker = async (photo: PhotoRec, data: { x: number | null; y: number | null; note: string | null }) => {
    if (!photo.id) return;
    await supabase.from('inspection_photos').update({
      marker_x: data.x, marker_y: data.y, marker_note: data.note,
    }).eq('id', photo.id);
    // Update local state
    if (photo.item_id) {
      setItemPhotos(prev => ({
        ...prev,
        [photo.item_id!]: (prev[photo.item_id!] ?? []).map(p => p.id === photo.id ? { ...p, marker_x: data.x, marker_y: data.y, marker_note: data.note } : p),
      }));
    }
    toast.success('Marker saved');
  };

  const goNext = async () => {
    await autoSave();
    if (unsavedRepair) { toast.error('Saved. Add a photo to each repair/urgent item.'); return; }
    if (!itemPhotoReq) { toast.error('Each Repair/Urgent item needs at least one photo'); return; }
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
              i === 1 ? 'bg-primary text-primary-foreground' : i < 1 ? 'bg-success text-success-foreground' : 'bg-secondary text-muted-foreground'
            }`}>
              {i < 1 ? <Check className="w-3 h-3" /> : i + 1}
            </div>
            {i < 3 && <div className="w-4 h-px bg-border" />}
          </div>
        ))}
      </div>

      <h2 className="text-lg font-bold text-foreground">{currentArea.label}</h2>

      {/* Items */}
      <div className="space-y-3">
        {currentItems.map((item, idx) => {
          const isNA = item.status === 'na';
          const needsPhoto = item.status === 'needs_repair' || item.status === 'urgent';
          const imgs = item.dbId ? (itemPhotos[item.dbId] ?? []) : [];
          const prior = priorItems[item.item_name];
          const priorExpanded = !!expandedPrior[item.item_name];
          return (
            <div key={item.item_name + idx} className={`bg-card border border-border rounded-[0.625rem] shadow-[var(--card-shadow)] p-3 ${isNA ? 'opacity-60' : ''}`}>
              <p className="text-sm font-medium text-foreground mb-2">{item.item_name}</p>
              <div className="flex gap-2">
                {([
                  { status: 'good' as const, label: 'Good', color: 'bg-success hover:bg-success/90 text-success-foreground', icon: Check },
                  { status: 'needs_repair' as const, label: 'Repair', color: 'bg-warning hover:bg-warning/90 text-warning-foreground', icon: CircleDot },
                  { status: 'urgent' as const, label: 'Urgent', color: 'bg-destructive hover:bg-destructive/90 text-white', icon: AlertTriangle },
                  { status: 'na' as const, label: 'N/A', color: 'bg-muted-foreground/70 hover:bg-muted-foreground text-white', icon: MinusCircle },
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

              {needsPhoto && (
                <>
                  <Textarea
                    value={item.item_note ?? ''}
                    onChange={e => setItemNote(idx, e.target.value)}
                    rows={2}
                    placeholder="Describe what needs repair..."
                    className="mt-2 text-sm"
                    maxLength={2000}
                  />

                  {/* Priority */}
                  <div className="mt-2">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Priority</span>
                    <div className="flex gap-2 mt-1">
                      {([
                        { p: 'low' as const, label: 'Low', color: 'bg-success text-success-foreground' },
                        { p: 'medium' as const, label: 'Medium', color: 'bg-warning text-warning-foreground' },
                        { p: 'high' as const, label: 'High', color: 'bg-destructive text-white' },
                      ]).map(opt => (
                        <button
                          key={opt.p}
                          onClick={() => setItemPriority(idx, opt.p)}
                          className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                            item.priority === opt.p ? opt.color : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Item photos */}
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Item Photos ({imgs.length}) — optional</span>
                    </div>
                    {!item.dbId ? (
                      <p className="text-[11px] text-muted-foreground">Photo upload available after saving (tap Next/Back once).</p>
                    ) : (
                      <>
                        <label className="flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-primary/40 rounded-md cursor-pointer hover:bg-primary/5 transition-colors">
                          <Camera className="w-4 h-4 text-primary" />
                          <span className="text-xs text-primary font-medium">Add photo for this item</span>
                          <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleItemPhotoUpload(e, item)} disabled={uploading} />
                        </label>
                        {imgs.length > 0 && (
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            {imgs.map(p => (
                              <div key={p.id} className="relative rounded-md overflow-hidden border border-border group">
                                <img src={p.displayUrl || p.url} alt="" className="w-full h-20 object-cover" />
                                {p.marker_x != null && p.marker_y != null && (
                                  <div
                                    className="absolute w-3 h-3 rounded-full bg-primary border-2 border-white shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                    style={{ left: `${p.marker_x * 100}%`, top: `${p.marker_y * 100}%` }}
                                  />
                                )}
                                <div className="absolute inset-x-0 bottom-0 flex justify-between p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/60 to-transparent">
                                  <button onClick={() => setMarkerPhoto(p)} className="text-white" title="Mark defect">
                                    <MapPin className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => handleDeletePhoto(p, item.dbId)} className="text-white" title="Delete">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}

              {/* Prior inspection reference */}
              {prior && (
                <button
                  onClick={() => setExpandedPrior(prev => ({ ...prev, [item.item_name]: !prev[item.item_name] }))}
                  className="mt-2 w-full flex items-center justify-between text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <span>Last time: {statusLabelMap[prior.status as ItemStatus] ?? prior.status} — {new Date(prior.date).toLocaleDateString()}</span>
                  {priorExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
              {prior && priorExpanded && prior.item_note && (
                <p className="mt-1 text-[11px] text-muted-foreground border-l-2 border-border pl-2">{prior.item_note}</p>
              )}
            </div>
          );
        })}
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
                    item_name: newItemName.trim(), area: currentArea.key, status: 'good' as ItemStatus,
                  }],
                }));
                setNewItemName(''); setShowAddItem(false);
              }
            }}
            autoFocus className="flex-1"
          />
          <Button size="sm" onClick={() => {
            if (!newItemName.trim()) return;
            setItems(prev => ({
              ...prev,
              [currentArea.key]: [...(prev[currentArea.key] ?? []), {
                item_name: newItemName.trim(), area: currentArea.key, status: 'good' as ItemStatus,
              }],
            }));
            setNewItemName(''); setShowAddItem(false);
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

      {/* Area-level photos */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            Area Photos ({currentPhotos.length}/{minPhotos} min)
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
              : 'Add Area Photos'}
          </span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleAreaPhotoUpload} disabled={uploading} />
        </label>
        {currentPhotos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {currentPhotos.map((p, i) => (
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

      {/* Area Notes */}
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
        <Button className="flex-1" onClick={goNext} disabled={!photosEnough || !itemPhotoReq || saving || uploading}>
          {saving ? <Spinner size="sm" /> : currentAreaIndex === areas.length - 1 ? (
            <>Finish <Check className="w-4 h-4 ml-1" /></>
          ) : (
            <>Next <ArrowRight className="w-4 h-4 ml-1" /></>
          )}
        </Button>
      </div>

      {markerPhoto && (
        <PhotoMarkerDialog
          open={!!markerPhoto}
          onOpenChange={(v) => { if (!v) setMarkerPhoto(null); }}
          imageUrl={markerPhoto.displayUrl || markerPhoto.url}
          initialX={markerPhoto.marker_x ?? null}
          initialY={markerPhoto.marker_y ?? null}
          initialNote={markerPhoto.marker_note ?? null}
          onSave={async (data) => { await handleSaveMarker(markerPhoto, data); }}
        />
      )}
    </div>
  );
};

export default AreaInspection;
