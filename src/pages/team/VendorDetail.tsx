import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ArrowLeft, Save, Upload, Download, Trash2, Plus, FileText, DollarSign, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import {
  getExpirationStatus,
  expirationBadgeClass,
  expirationLabel,
} from '@/lib/vendorAlerts';
import AddVendorPaymentDialog from '@/components/vendors/AddVendorPaymentDialog';
import MarkPaidDialog from '@/components/vendors/MarkPaidDialog';


const SPECIALTIES_CATALOG = [
  'Plumbing', 'Electrical', 'HVAC', 'Painting', 'Carpentry',
  'Flooring', 'Appliance Repair', 'Landscaping', 'General Maintenance',
  'Drywall', 'Roofing', 'Locksmith', 'Cleaning', 'Pest Control',
];

const DOC_TYPE_LABEL: Record<string, string> = {
  w9: 'W-9',
  insurance: 'Insurance',
  contract: 'Contract',
  other: 'Other',
};

const VendorDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const qc = useQueryClient();
  const { user, activeRole } = useAuthStore();
  const canManageDocs = activeRole === 'admin' || activeRole === 'supervisor';
  const canManagePayments = activeRole === 'admin' || activeRole === 'accounting';

  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    phone: '',
    email: '',
    specialties: [] as string[],
    license_number: '',
    insurance_info: '',
    notes: '',
    status: 'active',
    license_expiration_date: '',
    insurance_expiration_date: '',
  });
  const [saving, setSaving] = useState(false);

  const [docDialog, setDocDialog] = useState(false);
  const [newDoc, setNewDoc] = useState<{ doc_type: string; file: File | null }>({ doc_type: 'w9', file: null });
  const [uploading, setUploading] = useState(false);

  const [payDialog, setPayDialog] = useState(false);
  const [markPaid, setMarkPaid] = useState<{ id: string; amount: number } | null>(null);


  const { data: vendor } = useQuery({
    queryKey: ['vendor', id],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase.from('technicians_vendors').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (vendor) {
      setForm({
        company_name: vendor.company_name || '',
        contact_name: vendor.contact_name || '',
        phone: vendor.phone || '',
        email: vendor.email || '',
        specialties: vendor.specialties || [],
        license_number: vendor.license_number || '',
        insurance_info: vendor.insurance_info || '',
        notes: vendor.notes || '',
        status: vendor.status || 'active',
        license_expiration_date: (vendor as any).license_expiration_date || '',
        insurance_expiration_date: (vendor as any).insurance_expiration_date || '',
      });
    }
  }, [vendor]);

  const { data: documents = [], refetch: refetchDocs } = useQuery({
    queryKey: ['vendor_documents', id],
    queryFn: async () => {
      if (isNew) return [];
      const { data, error } = await supabase
        .from('vendor_documents')
        .select('*')
        .eq('vendor_id', id!)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !isNew && canManageDocs,
  });

  const { data: payments = [], refetch: refetchPay } = useQuery({
    queryKey: ['vendor_payments', id],
    queryFn: async () => {
      if (isNew) return [];
      const { data, error } = await supabase
        .from('vendor_payments')
        .select('*')
        .eq('vendor_id', id!)
        .order('due_date', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !isNew && (canManageDocs || canManagePayments),
  });


  const toggleSpecialty = (s: string) => {
    setForm(prev => ({
      ...prev,
      specialties: prev.specialties.includes(s) ? prev.specialties.filter(x => x !== s) : [...prev.specialties, s],
    }));
  };

  const handleSave = async () => {
    if (!form.company_name.trim()) { toast.error('Company name is required'); return; }
    setSaving(true);
    try {
      const payload: any = {
        company_name: form.company_name,
        contact_name: form.contact_name,
        phone: form.phone,
        email: form.email || null,
        specialties: form.specialties,
        license_number: form.license_number || null,
        insurance_info: form.insurance_info || null,
        notes: form.notes || null,
        status: form.status,
        type: 'vendor',
        license_expiration_date: form.license_expiration_date || null,
        insurance_expiration_date: form.insurance_expiration_date || null,
      };
      if (isNew) {
        const { error } = await supabase.from('technicians_vendors').insert(payload);
        if (error) throw error;
        toast.success('Vendor created');
      } else {
        const { error } = await supabase.from('technicians_vendors').update(payload).eq('id', id!);
        if (error) throw error;
        toast.success('Vendor updated');
        qc.invalidateQueries({ queryKey: ['vendor', id] });
      }
      navigate('/team/technicians');
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async () => {
    if (!newDoc.file || !user?.id || !id) return;
    setUploading(true);
    try {
      const ext = newDoc.file.name.split('.').pop();
      const path = `${id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('vendor-documents').upload(path, newDoc.file, {
        contentType: newDoc.file.type,
      });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from('vendor_documents').insert({
        vendor_id: id,
        doc_type: newDoc.doc_type,
        file_path: path,
        file_name: newDoc.file.name,
        uploaded_by: user.id,
      });
      if (dbErr) throw dbErr;
      toast.success('Document uploaded');
      setDocDialog(false);
      setNewDoc({ doc_type: 'w9', file: null });
      refetchDocs();
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: any) => {
    const { data, error } = await supabase.storage
      .from('vendor-documents')
      .createSignedUrl(doc.file_path, 60);
    if (error || !data?.signedUrl) { toast.error('Could not generate download link'); return; }
    window.open(data.signedUrl, '_blank');
  };

  const handleDeleteDoc = async (doc: any) => {
    if (!confirm(`Delete "${doc.file_name || doc.doc_type}"?`)) return;
    await supabase.storage.from('vendor-documents').remove([doc.file_path]);
    const { error } = await supabase.from('vendor_documents').delete().eq('id', doc.id);
    if (error) { toast.error('Delete failed'); return; }
    toast.success('Document deleted');
    refetchDocs();
  };




  const pendingPayments = (payments as any[]).filter(p => p.status === 'pending');
  const paidPayments = (payments as any[]).filter(p => p.status === 'paid');
  const balance = pendingPayments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const totalPaid = paidPayments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const oldestDue = pendingPayments
    .map(p => p.due_date)
    .filter(Boolean)
    .sort()[0] as string | undefined;
  const licStatus = getExpirationStatus(form.license_expiration_date);
  const insStatus = getExpirationStatus(form.insurance_expiration_date);


  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6 pb-16">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/team/technicians')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">{isNew ? 'New Vendor' : 'Vendor Details'}</h1>
      </div>

      {!isNew && (licStatus === 'expired' || licStatus === 'expiring' || insStatus === 'expired' || insStatus === 'expiring') && (
        <div className="flex flex-wrap gap-2">
          {(licStatus === 'expired' || licStatus === 'expiring') && (
            <Badge variant="outline" className={expirationBadgeClass(licStatus)}>
              {expirationLabel(licStatus, 'License')}
            </Badge>
          )}
          {(insStatus === 'expired' || insStatus === 'expiring') && (
            <Badge variant="outline" className={expirationBadgeClass(insStatus)}>
              {expirationLabel(insStatus, 'Insurance')}
            </Badge>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <Label>Company Name *</Label>
          <Input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
        </div>
        <div>
          <Label>Contact Name</Label>
          <Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label>Email (optional)</Label>
            <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>License #</Label>
            <Input value={form.license_number} onChange={e => setForm({ ...form, license_number: e.target.value })} />
          </div>
          <div>
            <Label>License expiration</Label>
            <Input type="date" value={form.license_expiration_date} onChange={e => setForm({ ...form, license_expiration_date: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Insurance Info</Label>
            <Input value={form.insurance_info} onChange={e => setForm({ ...form, insurance_info: e.target.value })} />
          </div>
          <div>
            <Label>Insurance expiration</Label>
            <Input type="date" value={form.insurance_expiration_date} onChange={e => setForm({ ...form, insurance_expiration_date: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />
        </div>
        <div>
          <Label>Status</Label>
          <div className="flex items-center gap-2 mt-1">
            <Switch checked={form.status === 'active'} onCheckedChange={v => setForm({ ...form, status: v ? 'active' : 'archived' })} />
            <span className="text-sm text-muted-foreground">{form.status === 'active' ? 'Active' : 'Archived'}</span>
          </div>
        </div>
        <div>
          <Label>Specialties</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {SPECIALTIES_CATALOG.map(s => (
              <Badge
                key={s}
                variant={form.specialties.includes(s) ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => toggleSpecialty(s)}
              >
                {s}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Vendor'}
      </Button>

      {!isNew && canManageDocs && (
        <section className="border border-border rounded-lg bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Documents
            </h2>
            <Button size="sm" variant="outline" onClick={() => setDocDialog(true)}>
              <Upload className="w-4 h-4 mr-1" /> Upload
            </Button>
          </div>
          {documents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No documents uploaded.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {documents.map((doc: any) => (
                <div key={doc.id} className="flex items-center gap-2 p-2 rounded border border-border">
                  <Badge variant="secondary" className="text-[10px]">{DOC_TYPE_LABEL[doc.doc_type] ?? doc.doc_type}</Badge>
                  <span className="flex-1 text-xs text-foreground truncate">{doc.file_name || doc.file_path.split('/').pop()}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownload(doc)}>
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  {activeRole === 'admin' && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteDoc(doc)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {!isNew && (canManageDocs || canManagePayments) && (
        <section className="border border-border rounded-lg bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" /> Payments
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total paid: <span className="text-foreground font-semibold">${totalPaid.toFixed(2)}</span>
              </p>
            </div>
            {canManagePayments && (
              <Button size="sm" variant="outline" onClick={() => setPayDialog(true)}>
                <Plus className="w-4 h-4 mr-1" /> Log
              </Button>
            )}
          </div>
          {payments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No payments logged.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {payments.map((p: any) => (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded border border-border text-xs">
                  <span className="font-semibold text-foreground">${Number(p.amount).toFixed(2)}</span>
                  <span className="text-muted-foreground">{p.payment_date}</span>
                  {p.note && <span className="flex-1 truncate text-muted-foreground">— {p.note}</span>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Upload doc dialog */}
      <Dialog open={docDialog} onOpenChange={setDocDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Type</Label>
              <Select value={newDoc.doc_type} onValueChange={v => setNewDoc(p => ({ ...p, doc_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="w9">W-9</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>File</Label>
              <Input type="file" onChange={e => setNewDoc(p => ({ ...p, file: e.target.files?.[0] ?? null }))} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpload} disabled={!newDoc.file || uploading}>
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log Payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount ($)</Label>
              <Input type="number" step="0.01" min="0" value={newPay.amount} onChange={e => setNewPay(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={newPay.payment_date} onChange={e => setNewPay(p => ({ ...p, payment_date: e.target.value }))} />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input value={newPay.note} onChange={e => setNewPay(p => ({ ...p, note: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddPayment} disabled={savingPay}>
              {savingPay ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorDetail;
