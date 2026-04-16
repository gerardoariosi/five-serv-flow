import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Minus, Search, Play, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import Spinner from '@/components/ui/Spinner';

const CreateInspection = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [activeInspectionPropertyIds, setActiveInspectionPropertyIds] = useState<string[]>([]);
  const [propertySearch, setPropertySearch] = useState('');
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [newAddressDialog, setNewAddressDialog] = useState<{ open: boolean; address: string; pmName: string }>({ open: false, address: '', pmName: '' });
  const [newPropertyName, setNewPropertyName] = useState('');
  const [mode, setMode] = useState<'now' | 'schedule'>('now');
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleTime, setScheduleTime] = useState('09:00');

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
        supabase.from('properties').select('id, name, address, current_pm_id').eq('status', 'active'),
        supabase.from('inspections').select('property_id').not('status', 'in', '("closed_internally","complete","converted")'),
      ]);
      setClients(cRes.data ?? []);
      setProperties(pRes.data ?? []);
      setActiveInspectionPropertyIds((iRes.data ?? []).map((i: any) => i.property_id).filter(Boolean));
    };
    fetchOptions();
  }, []);

  const filteredProperties = useMemo(() => {
    let result = form.client_id
      ? properties.filter((p: any) => p.current_pm_id === form.client_id)
      : properties;

    if (propertySearch.trim()) {
      const q = propertySearch.toLowerCase();
      result = result.filter((p: any) =>
        p.name?.toLowerCase().includes(q) || p.address?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [properties, form.client_id, propertySearch]);

  const selectedProperty = properties.find((p: any) => p.id === form.property_id);
  const propertyHasActiveInspection = form.property_id && activeInspectionPropertyIds.includes(form.property_id);
  const selectedPmName = clients.find((c: any) => c.id === form.client_id)?.company_name ?? '';

  const handleCounter = (field: 'bedrooms' | 'bathrooms' | 'living_rooms', delta: number) => {
    setForm(prev => ({ ...prev, [field]: Math.max(0, prev[field] + delta) }));
  };

  const handleSelectProperty = (propId: string) => {
    setForm(p => ({ ...p, property_id: propId }));
    const prop = properties.find((p: any) => p.id === propId);
    setPropertySearch(prop ? (prop.address || prop.name || '') : '');
    setShowPropertyDropdown(false);
  };

  const handleAddNewAddress = () => {
    if (!form.client_id) {
      toast.error('Select a PM first');
      return;
    }
    setNewAddressDialog({ open: true, address: propertySearch, pmName: selectedPmName });
    setNewPropertyName(propertySearch);
  };

  const handleConfirmNewProperty = async () => {
    if (!newPropertyName.trim()) return;
    try {
      const { data, error } = await supabase.from('properties').insert({
        name: newPropertyName,
        address: newPropertyName,
        current_pm_id: form.client_id,
        status: 'active',
      }).select('id, name, address, current_pm_id').single();

      if (error) throw error;

      setProperties(prev => [...prev, data]);
      setForm(p => ({ ...p, property_id: data.id }));
      setPropertySearch(data.address || data.name || '');
      setNewAddressDialog({ open: false, address: '', pmName: '' });
      toast.success('Property created and linked.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create property');
    }
  };

  const handleSubmit = async () => {
    if (!form.property_id) { toast.error('Property is required'); return; }
    if (propertyHasActiveInspection) { toast.error('This property already has an active inspection'); return; }

    let scheduledAt: Date | null = null;
    let visitDate = form.visit_date || null;
    if (mode === 'schedule') {
      if (!scheduleDate) { toast.error('Pick a date for the scheduled inspection'); return; }
      const [hh, mm] = scheduleTime.split(':').map(Number);
      scheduledAt = new Date(scheduleDate);
      scheduledAt.setHours(hh || 9, mm || 0, 0, 0);
      visitDate = format(scheduledAt, 'yyyy-MM-dd');
    }

    setSaving(true);
    try {
      const { data: insNumber } = await supabase.rpc('generate_ins_number');

      const { data: inserted, error } = await supabase.from('inspections').insert({
        ins_number: insNumber as string,
        client_id: form.client_id || null,
        property_id: form.property_id,
        visit_date: visitDate,
        bedrooms: form.bedrooms,
        bathrooms: form.bathrooms,
        living_rooms: form.living_rooms,
        has_garage: form.has_garage,
        has_laundry: form.has_laundry,
        has_exterior: form.has_exterior,
        status: mode === 'schedule' ? 'scheduled' : 'draft',
      }).select('id').single();

      if (error) throw error;
      if (mode === 'schedule') {
        toast.success('Inspection scheduled');
        navigate('/inspections');
      } else {
        toast.success('Inspection created');
        navigate(`/inspections/${inserted!.id}/inspect`);
      }
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
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {['Config', 'Inspect', 'Pricing', 'Sent'].map((step, i) => (
          <div key={step} className="flex items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
            }`}>
              {i + 1}
            </div>
            <span className={`text-xs ${i === 0 ? 'text-foreground' : 'text-muted-foreground'}`}>{step}</span>
            {i < 3 && <div className="w-4 sm:w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {/* Client */}
        <div>
          <Label>Client (PM)</Label>
          <Select value={form.client_id} onValueChange={v => {
            setForm(p => ({ ...p, client_id: v, property_id: '' }));
            setPropertySearch('');
          }}>
            <SelectTrigger><SelectValue placeholder="Select PM" /></SelectTrigger>
            <SelectContent>
              {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Property — searchable dropdown */}
        <div className="relative">
          <Label>Property / Address</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={propertySearch}
              onChange={e => {
                setPropertySearch(e.target.value);
                setShowPropertyDropdown(true);
                setForm(p => ({ ...p, property_id: '' }));
              }}
              onFocus={() => setShowPropertyDropdown(true)}
              placeholder="Search property or address..."
              className={`pl-10 ${propertyHasActiveInspection ? 'border-destructive' : ''}`}
            />
          </div>
          {showPropertyDropdown && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
              {filteredProperties.length > 0 ? (
                filteredProperties.map((p: any) => {
                  const hasActive = activeInspectionPropertyIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => !hasActive && handleSelectProperty(p.id)}
                      disabled={hasActive}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${hasActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span className="font-medium text-foreground">{p.address || p.name}</span>
                      {hasActive && <span className="text-destructive ml-2 text-xs">(active inspection)</span>}
                    </button>
                  );
                })
              ) : null}
              {propertySearch.trim() && (
                <button
                  onClick={handleAddNewAddress}
                  className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-accent transition-colors border-t border-border flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add new address: "{propertySearch}"
                </button>
              )}
              {!propertySearch.trim() && filteredProperties.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {form.client_id ? 'No properties for this PM. Type to add.' : 'Select a PM first or type to search.'}
                </div>
              )}
            </div>
          )}
          {propertyHasActiveInspection && (
            <p className="text-xs text-destructive mt-1">This property already has an active inspection.</p>
          )}
        </div>

        {/* Start Now vs Schedule */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <Label>When?</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === 'now' ? 'default' : 'outline'}
              onClick={() => setMode('now')}
              className="h-12"
            >
              <Play className="w-4 h-4 mr-2" /> Start Now
            </Button>
            <Button
              type="button"
              variant={mode === 'schedule' ? 'default' : 'outline'}
              onClick={() => setMode('schedule')}
              className="h-12"
            >
              <CalendarIcon className="w-4 h-4 mr-2" /> Schedule
            </Button>
          </div>

          {mode === 'now' && (
            <div>
              <Label className="text-xs">Visit Date (optional)</Label>
              <Input type="date" value={form.visit_date} onChange={e => setForm(p => ({ ...p, visit_date: e.target.value }))} />
            </div>
          )}

          {mode === 'schedule' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn('w-full justify-start text-left font-normal', !scheduleDate && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduleDate ? format(scheduleDate, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduleDate}
                      onSelect={setScheduleDate}
                      disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs">Time</Label>
                <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} />
              </div>
            </div>
          )}
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

          <p className="text-xs text-muted-foreground italic">HVAC / A-C is always included.</p>
        </div>

        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={saving || !!propertyHasActiveInspection || (mode === 'schedule' && !scheduleDate)}>
          {saving ? <Spinner size="sm" /> : (mode === 'schedule' ? 'Schedule Inspection →' : 'Start Inspection →')}
        </Button>
      </div>

      {/* Add New Property Confirmation Dialog */}
      <Dialog open={newAddressDialog.open} onOpenChange={o => setNewAddressDialog(p => ({ ...p, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Property</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Add <span className="font-medium text-foreground">"{newPropertyName}"</span> to{' '}
            <span className="font-medium text-foreground">{newAddressDialog.pmName}</span>?
            This will create a new property.
          </p>
          <Input
            value={newPropertyName}
            onChange={e => setNewPropertyName(e.target.value)}
            placeholder="Property name / address"
            className="bg-secondary border-border"
          />
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setNewAddressDialog({ open: false, address: '', pmName: '' })}>Cancel</Button>
            <Button onClick={handleConfirmNewProperty} disabled={!newPropertyName.trim()} className="bg-primary text-primary-foreground">
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreateInspection;
