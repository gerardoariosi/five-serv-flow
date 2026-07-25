import { useState, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Upload, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { downloadPropertyCsvTemplate, PROPERTY_CSV_HEADERS } from '@/lib/propertyCsvTemplate';

const MAX_ROWS = 500;
const ZIP_RE = /^\d{5}(-\d{4})?$/;

type Row = {
  name: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  zone: string; // zone name or id (id when picked from dropdown)
  zoneResolved?: string | null; // resolved zone id
  included: boolean;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
}

export default function ImportPropertiesDialog({ open, onOpenChange, clientId }: Props) {
  const [stage, setStage] = useState<'upload' | 'preview' | 'result'>('upload');
  const [rows, setRows] = useState<Row[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: zones = [] } = useQuery({
    queryKey: ['zones-dropdown-import'],
    queryFn: async () => {
      const { data } = await supabase.from('zones').select('id, name').eq('status', 'active').order('name');
      return data ?? [];
    },
    enabled: open,
  });

  const zoneByName = useMemo(() => {
    const m = new Map<string, string>();
    zones.forEach(z => z.name && m.set(z.name.toLowerCase(), z.id));
    return m;
  }, [zones]);

  const reset = () => {
    setRows([]);
    setStage('upload');
    setCreatedCount(0);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase(),
      complete: (res) => {
        const data = (res.data as any[]).slice(0, MAX_ROWS);
        if ((res.data as any[]).length > MAX_ROWS) {
          toast.warning(`Only the first ${MAX_ROWS} rows will be imported.`);
        }
        const parsed: Row[] = data.map(r => {
          const zoneName = (r.zone || '').trim();
          const resolved = zoneName ? zoneByName.get(zoneName.toLowerCase()) ?? null : null;
          return {
            name: (r.name || '').trim(),
            street_address: (r.street_address || '').trim(),
            city: (r.city || '').trim(),
            state: (r.state || '').trim(),
            zip_code: (r.zip_code || '').trim(),
            zone: resolved ?? '', // if resolved, store id; otherwise empty (unmatched)
            zoneResolved: resolved,
            included: true,
          };
        });
        setRows(parsed);
        setStage('preview');
      },
      error: (err) => toast.error(`CSV parse error: ${err.message}`),
    });
  };

  const validateRow = (r: Row): string[] => {
    const errs: string[] = [];
    if (!r.street_address) errs.push('Street address required');
    if (!r.city) errs.push('City required');
    if (r.zip_code && !ZIP_RE.test(r.zip_code)) errs.push('Invalid ZIP');
    return errs;
  };

  const rowErrors = useMemo(() => rows.map(validateRow), [rows]);
  const includedValid = rows.filter((r, i) => r.included && rowErrors[i].length === 0).length;
  const includedInvalid = rows.filter((r, i) => r.included && rowErrors[i].length > 0).length;
  const canConfirm = includedValid > 0 && includedInvalid === 0;

  const updateRow = (idx: number, patch: Partial<Row>) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const payload = rows
        .filter((r, i) => r.included && rowErrors[i].length === 0)
        .map(r => {
          const full = [r.street_address, r.city, [r.state, r.zip_code].filter(Boolean).join(' ')]
            .filter(Boolean).join(', ');
          return {
            name: r.name || null,
            street_address: r.street_address,
            city: r.city,
            state: r.state || null,
            zip_code: r.zip_code || null,
            address: full,
            full_address: full,
            zone_id: r.zone || null,
            current_pm_id: clientId,
          };
        });
      const { error, data } = await supabase.from('properties').insert(payload).select('id');
      if (error) throw error;
      setCreatedCount(data?.length ?? payload.length);
      setStage('result');
      queryClient.invalidateQueries({ queryKey: ['client-properties', clientId] });
    } catch (e: any) {
      toast.error(e.message || 'Import failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Properties (CSV)</DialogTitle>
        </DialogHeader>

        {stage === 'upload' && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV with columns: {PROPERTY_CSV_HEADERS.join(', ')}. Max {MAX_ROWS} rows per import.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadPropertyCsvTemplate}>
                <Download className="w-4 h-4 mr-2" /> Download template
              </Button>
              <Button onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" /> Choose CSV file
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          </div>
        )}

        {stage === 'preview' && (
          <div className="flex-1 overflow-auto">
            <div className="flex items-center justify-between mb-3 text-sm">
              <span>
                <strong>{includedValid}</strong> ready to import
                {includedInvalid > 0 && <span className="text-destructive ml-2">· {includedInvalid} with errors</span>}
              </span>
              <Button variant="ghost" size="sm" onClick={reset}>Start over</Button>
            </div>
            <div className="overflow-auto border border-border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 w-8"></th>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Street *</th>
                    <th className="p-2 text-left">City *</th>
                    <th className="p-2 text-left">State</th>
                    <th className="p-2 text-left">ZIP</th>
                    <th className="p-2 text-left">Zone</th>
                    <th className="p-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const errs = rowErrors[i];
                    const hasErr = r.included && errs.length > 0;
                    return (
                      <tr key={i} className={hasErr ? 'border-l-2 border-destructive bg-destructive/5' : ''}>
                        <td className="p-1 text-center">
                          <input
                            type="checkbox"
                            checked={r.included}
                            onChange={(e) => updateRow(i, { included: e.target.checked })}
                          />
                        </td>
                        <td className="p-1"><Input value={r.name} onChange={(e) => updateRow(i, { name: e.target.value })} className="h-8" /></td>
                        <td className="p-1"><Input value={r.street_address} onChange={(e) => updateRow(i, { street_address: e.target.value })} className="h-8" /></td>
                        <td className="p-1"><Input value={r.city} onChange={(e) => updateRow(i, { city: e.target.value })} className="h-8" /></td>
                        <td className="p-1"><Input value={r.state} onChange={(e) => updateRow(i, { state: e.target.value })} className="h-8 w-16" /></td>
                        <td className="p-1"><Input value={r.zip_code} onChange={(e) => updateRow(i, { zip_code: e.target.value })} className="h-8 w-24" /></td>
                        <td className="p-1">
                          <Select value={r.zone || '__none__'} onValueChange={(v) => updateRow(i, { zone: v === '__none__' ? '' : v })}>
                            <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">(none)</SelectItem>
                              {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-1">
                          <button onClick={() => setRows(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {includedInvalid > 0 && (
              <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Fix or uncheck rows with errors to enable import.
              </p>
            )}
          </div>
        )}

        {stage === 'result' && (
          <div className="py-8 text-center">
            <p className="text-lg font-medium">{createdCount} properties created</p>
          </div>
        )}

        <DialogFooter>
          {stage === 'preview' && (
            <Button onClick={handleConfirm} disabled={!canConfirm || submitting}>
              {submitting ? 'Importing…' : `Confirm Import (${includedValid})`}
            </Button>
          )}
          {stage === 'result' && <Button onClick={() => handleClose(false)}>Done</Button>}
          {stage === 'upload' && <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
