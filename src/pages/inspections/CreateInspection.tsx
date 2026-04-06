import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Minus } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import Spinner from '@/components/ui/Spinner';

const CreateInspection = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [activeInspectionPropertyIds, setActiveInspectionPropertyIds] = useState<string[]>([]);

  const [form, setForm] = useState({
    client_id: '',
    property_id: '',
    visit_date: '',
    bedrooms: 1,
    bathrooms: 1,
    living_rooms: 1,
    has_garage: false,
    has_laundry: false,
    has_exterior: false,
  });

  useEffect(() => {
    const fetchOptions = async () => {
      const [cRes, pRes, iRes] = await Promise.all([
        supabase.from('clients').select('id, company_name').eq('status', 'active'),
        supabase.from('properties').select('id, name, current_pm_id').eq('status', 'active'),
        supabase.from('inspections').select('property_id').not('status', 'in', '("closed_internally","complete","converted")'),
      ]);
      setClients(cRes.data ?? []);
      setProperties(pRes.data ?? []);
      setActiveInspectionPropertyIds((iRes.data ?? []).map((i: any) => i.property_id).filter(Boolean));
    };
    fetchOptions();
  }, []);

  const filteredProperties = form.client_id
    ? properties.filter((p: any) => p.current_pm_id === form.client_id)
    : properties;

  const propertyHasActiveInspection = form.property_id && activeInspectionPropertyIds.includes(form.property_id);

  const handleCounter = (field: 'bedrooms' | 'bathrooms' | 'living_rooms', delta: number) => {
    setForm(prev => ({ ...prev, [field]: Math.max(0, prev[field] + delta) }));
  };

  const handleSubmit = async () => {
    if (!form.property_id) { toast.error('Property is required'); return; }
    if (propertyHasActiveInspection) { toast.error('This property already has an active inspection'); return; }

    setSaving(true);
    try {
      const { data: insNumber } = await supabase.rpc('generate_ins_number');

      const { data: inserted, error } = await supabase.from('inspections').insert({
        ins_number: insNumber as string,
        client_id: form.client_id || null,
        property_id: form.property_id,
        visit_date: form.visit_date || null,
        bedrooms: form.bedrooms,
        bathrooms: form.bathrooms,
        living_rooms: form.living_rooms,
        has_garage: form.has_garage,
        has_laundry: form.has_laundry,
        has_exterior: form.has_exterior,
        status: 'draft',
      }).select('id').single();

      if (error) throw error;
      toast.success('Inspection created');
      navigate(`/inspections/${inserted!.id}/inspect`);
    } catch (err: any) {
      toast.error(err.message || 'Error creating inspection');
    }
    setSaving(false);
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-foreground">New Inspection</h1>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-center gap-2">
        {['Config', 'Inspect', 'Pricing', 'Sent'].map((step, i) => (
          <div key={step} className="flex items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
            }`}>
              {i + 1}
            </div>
            <span className={`text-xs ${i === 0 ? 'text-foreground' : 'text-muted-foreground'}`}>{step}</span>
            {i < 3 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {/* Client */}
        <div>
          <Label>Client (PM)</Label>
          <Select value={form.client_id} onValueChange={v => setForm(p => ({ ...p, client_id: v, property_id: '' }))}>
            <SelectTrigger><SelectValue placeholder="Select PM" /></SelectTrigger>
            <SelectContent>
              {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Property */}
        <div>
          <Label>Property</Label>
          <Select value={form.property_id} onValueChange={v => setForm(p => ({ ...p, property_id: v }))}>
            <SelectTrigger className={propertyHasActiveInspection ? 'border-destructive' : ''}>
              <SelectValue placeholder="Select property" />
            </SelectTrigger>
            <SelectContent>
              {filteredProperties.map((p: any) => (
                <SelectItem key={p.id} value={p.id} disabled={activeInspectionPropertyIds.includes(p.id)}>
                  {p.name} {activeInspectionPropertyIds.includes(p.id) ? '(active inspection)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {propertyHasActiveInspection && (
            <p className="text-xs text-destructive mt-1">This property already has an active inspection.</p>
          )}
        </div>

        {/* Visit Date */}
        <div>
          <Label>Visit Date (optional)</Label>
          <Input type="date" value={form.visit_date} onChange={e => setForm(p => ({ ...p, visit_date: e.target.value }))} />
        </div>

        {/* Room counters */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Property Configuration</h3>

          {(['bedrooms', 'bathrooms', 'living_rooms'] as const).map(field => (
            <div key={field} className="flex items-center justify-between">
              <Label className="capitalize">{field.replace('_', ' ')}</Label>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleCounter(field, -1)} disabled={form[field] <= 0}>
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-foreground font-bold w-6 text-center">{form[field]}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleCounter(field, 1)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {/* Toggles */}
          <div className="space-y-3 pt-2 border-t border-border">
            {([
              { key: 'has_garage', label: 'Garage' },
              { key: 'has_laundry', label: 'Laundry' },
              { key: 'has_exterior', label: 'Exterior / Patio' },
            ] as const).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <Label>{label}</Label>
                <Switch checked={form[key]} onCheckedChange={v => setForm(p => ({ ...p, [key]: v }))} />
              </div>
            ))}
          </div>

          {/* HVAC always present */}
          <p className="text-xs text-muted-foreground italic">HVAC / A-C is always included.</p>
        </div>

        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={saving || !!propertyHasActiveInspection}>
          {saving ? <Spinner size="sm" /> : 'Start Inspection →'}
        </Button>
      </div>
    </div>
  );
};

export default CreateInspection;
