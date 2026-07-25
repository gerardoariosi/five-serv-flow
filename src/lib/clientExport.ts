import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB per file
const WARN_TOTAL_BYTES = 100 * 1024 * 1024; // 100 MB total warning

const slugify = (s: string) =>
  (s || 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const fetchStorageFile = async (
  bucket: string,
  path: string,
): Promise<{ blob: Blob | null; skipped?: string }> => {
  const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (!signed?.signedUrl) return { blob: null, skipped: 'no signed URL' };
  try {
    const res = await fetch(signed.signedUrl);
    if (!res.ok) return { blob: null, skipped: `http ${res.status}` };
    const contentLength = Number(res.headers.get('content-length') || 0);
    if (contentLength > MAX_FILE_BYTES) return { blob: null, skipped: 'file too large (>25MB)' };
    const blob = await res.blob();
    if (blob.size > MAX_FILE_BYTES) return { blob: null, skipped: 'file too large (>25MB)' };
    return { blob };
  } catch (e) {
    return { blob: null, skipped: (e as Error).message };
  }
};

export interface ExportResult {
  ok: boolean;
  totalBytes: number;
  skipped: string[];
}

export const exportClientZip = async (
  clientId: string,
  actorEmail?: string,
): Promise<ExportResult> => {
  const skipped: string[] = [];

  const { data: client, error: cErr } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();
  if (cErr || !client) throw new Error('Client not found');

  const [propsRes, ticketsRes, inspRes, cNotesRes] = await Promise.all([
    supabase.from('properties').select('*').eq('current_pm_id', clientId),
    supabase.from('tickets').select('*').eq('client_id', clientId),
    supabase.from('inspections').select('*').eq('client_id', clientId),
    supabase.from('client_notes').select('*').eq('client_id', clientId),
  ]);

  const propertyIds = (propsRes.data ?? []).map((p) => p.id);
  const [pNotesRes, ticketPhotosRes, insPhotosRes] = await Promise.all([
    propertyIds.length
      ? supabase.from('property_notes').select('*').in('property_id', propertyIds)
      : Promise.resolve({ data: [] as any[] }),
    (ticketsRes.data ?? []).length
      ? supabase
          .from('ticket_photos')
          .select('*')
          .in('ticket_id', (ticketsRes.data ?? []).map((t) => t.id))
      : Promise.resolve({ data: [] as any[] }),
    (inspRes.data ?? []).length
      ? supabase
          .from('inspection_photos')
          .select('*')
          .in('inspection_id', (inspRes.data ?? []).map((i) => i.id))
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const zip = new JSZip();
  const rootName = slugify(client.company_name ?? 'client');
  const root = zip.folder(rootName)!;

  root.file('client.json', JSON.stringify(client, null, 2));
  root.file('properties.json', JSON.stringify(propsRes.data ?? [], null, 2));
  root.file('tickets.json', JSON.stringify(ticketsRes.data ?? [], null, 2));
  root.file('inspections.json', JSON.stringify(inspRes.data ?? [], null, 2));
  root.file('client_notes.json', JSON.stringify(cNotesRes.data ?? [], null, 2));
  root.file('property_notes.json', JSON.stringify(pNotesRes.data ?? [], null, 2));

  let totalBytes = 0;

  const photosFolder = root.folder('photos')!;
  const addPhotos = async (
    rows: any[],
    bucket: string,
    idKey: string,
    subfolder: string,
  ) => {
    const sub = photosFolder.folder(subfolder)!;
    for (const row of rows) {
      const path: string | undefined = row.file_path ?? row.photo_url ?? row.url;
      if (!path) continue;
      // Only attempt storage bucket paths (skip absolute URLs to external hosts)
      const storagePath = path.replace(/^\/+/, '');
      const { blob, skipped: reason } = await fetchStorageFile(bucket, storagePath);
      if (!blob) {
        skipped.push(`${subfolder}/${row[idKey] ?? row.id}: ${reason ?? 'unknown'}`);
        continue;
      }
      totalBytes += blob.size;
      const filename = `${row[idKey] ?? row.id}_${storagePath.split('/').pop() ?? 'file'}`;
      sub.file(filename, blob);
    }
  };

  await addPhotos(ticketPhotosRes.data ?? [], 'ticket-photos', 'ticket_id', 'tickets');
  await addPhotos(insPhotosRes.data ?? [], 'inspection-photos', 'inspection_id', 'inspections');

  root.file(
    'README.txt',
    [
      `FiveServ Client Export`,
      `Client: ${client.company_name ?? 'Unnamed'}`,
      `Exported: ${new Date().toISOString()}`,
      actorEmail ? `Exported by: ${actorEmail}` : '',
      `Total binary bytes: ${totalBytes}`,
      '',
      skipped.length ? `Skipped files (${skipped.length}):` : 'No files skipped.',
      ...skipped.map((s) => `  - ${s}`),
    ]
      .filter(Boolean)
      .join('\n'),
  );

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  downloadBlob(blob, `${rootName}-export-${new Date().toISOString().slice(0, 10)}.zip`);

  return { ok: true, totalBytes, skipped };
};

export { WARN_TOTAL_BYTES };
