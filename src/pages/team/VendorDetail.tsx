import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Edit, Upload, Download, Trash2, Plus, FileText, DollarSign, Clock, Mail, Phone, Wrench, MoreVertical, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getExpirationStatus, expirationLabel,
} from '@/lib/vendorAlerts';
import AddVendorPaymentDialog from '@/components/vendors/AddVendorPaymentDialog';
import MarkPaidDialog from '@/components/vendors/MarkPaidDialog';
import EditVendorPaymentDialog from '@/components/vendors/EditVendorPaymentDialog';
import ProofLink from '@/components/vendors/ProofLink';
import DetailHeader from '@/components/detail/DetailHeader';
import DetailActions from '@/components/detail/DetailActions';
import FieldGroup from '@/components/detail/FieldGroup';
import FieldRow from '@/components/detail/FieldRow';
import SectionTabs from '@/components/detail/SectionTabs';
import EmptyBlock from '@/components/detail/EmptyBlock';
import StatusPill from '@/components/detail/StatusPill';

const DOC_TYPE_LABEL: Record<string, string> = {
  w9: 'W-9', insurance: 'Insurance', contract: 'Contract', other: 'Other',
};

const VendorDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, activeRole } = useAuthStore();
  const canEdit = activeRole === 'admin' || activeRole === 'supervisor';
  const canManageDocs = canEdit;
  const canManagePayments = activeRole === 'admin' || activeRole === 'accounting';

  const [docDialog, setDocDialog] = useState(false);
  const [newDoc, setNewDoc] = useState<{ doc_type: string; file: File | null }>({ doc_type: 'w9', file: null });
  const [uploading, setUploading] = useState(false);
  const [payDialog, setPayDialog] = useState(false);
  const [markPaid, setMarkPaid] = useState<{ id: string; amount: number } | null>(null);
  const [editPayment, setEditPayment] = useState<any | null>(null);
  const [deletePayment, setDeletePayment] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<'documents' | 'payments'>('documents');

  const { data: vendor, isLoading } = useQuery({
    queryKey: ['vendor', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('technicians_vendors').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: documents = [], refetch: refetchDocs } = useQuery({
    queryKey: ['vendor_documents', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('vendor_documents').select('*').eq('vendor_id', id!).order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id && canManageDocs,
  });

  const { data: payments = [], refetch: refetchPay } = useQuery({
    queryKey: ['vendor_payments', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('vendor_payments').select('*').eq('vendor_id', id!).order('due_date', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id && (canManageDocs || canManagePayments),
  });

  const handleUpload = async () => {
    if (!newDoc.file || !user?.id || !id) return;
    setUploading(true);
    try {
      const ext = newDoc.file.name.split('.').pop();
      const path = `${id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('vendor-documents').upload(path, newDoc.file, { contentType: newDoc.file.type });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from('vendor_documents').insert({
        vendor_id: id, doc_type: newDoc.doc_type, file_path: path, file_name: newDoc.file.name, uploaded_by: user.id,
      });
      if (dbErr) throw dbErr;
      toast.success('Document uploaded');
      setDocDialog(false);
      setNewDoc({ doc_type: 'w9', file: null });
      refetchDocs();
    } catch (e: any) { toast.error(e?.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const handleDownload = async (doc: any) => {
    const { data, error } = await supabase.storage.from('vendor-documents').createSignedUrl(doc.file_path, 60);
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

  if (isLoading || !vendor) {
    return <div className="p-4 max-w-3xl mx-auto"><p className="text-sm text-muted-foreground">Loading vendor…</p></div>;
  }

  const pendingPayments = (payments as any[]).filter(p => p.status === 'pending');
  const paidPayments = (payments as any[]).filter(p => p.status === 'paid');
  const balance = pendingPayments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const totalPaid = paidPayments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const oldestDue = pendingPayments.map(p => p.due_date).filter(Boolean).sort()[0] as string | undefined;

  const licStatus = getExpirationStatus((vendor as any).license_expiration_date);
  const insStatus = getExpirationStatus((vendor as any).insurance_expiration_date);

  const statusPills = (
    <>
      <StatusPill variant={vendor.status === 'active' ? 'success' : 'neutral'}>
        {vendor.status === 'active' ? 'Active' : 'Archived'}
      </StatusPill>
      {(licStatus === 'expired' || licStatus === 'expiring') && (
        <StatusPill variant={licStatus === 'expired' ? 'danger' : 'warning'}>
          {expirationLabel(licStatus, 'License')}
        </StatusPill>
      )}
      {(insStatus === 'expired' || insStatus === 'expiring') && (
        <StatusPill variant={insStatus === 'expired' ? 'danger' : 'warning'}>
          {expirationLabel(insStatus, 'Insurance')}
        </StatusPill>
      )}
    </>
  );

  const subline = [
    vendor.contact_name,
    vendor.specialties && vendor.specialties.length > 0 && `${vendor.specialties.length} ${vendor.specialties.length === 1 ? 'specialty' : 'specialties'}`,
  ].filter(Boolean).join(' · ');

  const primaryAction = tab === 'payments' && canManagePayments
    ? <Button size="sm" onClick={() => setPayDialog(true)}><Plus className="w-4 h-4 mr-1" /> Add Payment</Button>
    : canManageDocs
      ? <Button size="sm" onClick={() => setDocDialog(true)}><Upload className="w-4 h-4 mr-1" /> Upload Document</Button>
      : null;

  const ghostActions = (
    <>
      {vendor.email && (
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <a href={`mailto:${vendor.email}`} aria-label="Email"><Mail className="w-4 h-4" /></a>
        </Button>
      )}
      {vendor.phone && (
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <a href={`tel:${vendor.phone}`} aria-label="Call"><Phone className="w-4 h-4" /></a>
        </Button>
      )}
    </>
  );

  const overflow = canEdit ? (
    <DropdownMenuItem onClick={() => navigate(`/team/vendors/${id}/edit`)}>
      <Edit className="w-4 h-4 mr-2" /> Edit
    </DropdownMenuItem>
  ) : null;

  return (
    <div className="p-4 max-w-3xl mx-auto pb-16">
      <DetailHeader
        backTo="/team/technicians"
        icon={<Wrench className="w-4 h-4" />}
        name={vendor.company_name}
        subline={subline || undefined}
        status={statusPills}
        actions={<DetailActions primary={primaryAction} ghost={ghostActions} overflow={overflow} />}
      />

      <FieldGroup label="Contact" first>
        <FieldRow label="Phone" value={vendor.phone ? <a href={`tel:${vendor.phone}`} className="hover:text-primary">{vendor.phone}</a> : null} />
        <FieldRow label="Email" value={vendor.email ? <a href={`mailto:${vendor.email}`} className="hover:text-primary break-all">{vendor.email}</a> : null} />
      </FieldGroup>

      <FieldGroup label="Compliance">
        <FieldRow label="License #" value={vendor.license_number} />
        <FieldRow label="License exp." value={(vendor as any).license_expiration_date} />
        <FieldRow label="Insurance" value={vendor.insurance_info} />
        <FieldRow label="Insurance exp." value={(vendor as any).insurance_expiration_date} />
      </FieldGroup>

      {vendor.specialties && vendor.specialties.length > 0 && (
        <FieldGroup label="Specialties">
          <div className="flex flex-wrap gap-1 py-1.5">
            {vendor.specialties.map((s: string) => (
              <Badge key={s} variant="secondary" className="text-[11px] font-normal">{s}</Badge>
            ))}
          </div>
        </FieldGroup>
      )}

      {vendor.notes && (
        <FieldGroup label="Notes">
          <p className="text-sm text-foreground whitespace-pre-wrap py-1.5">{vendor.notes}</p>
        </FieldGroup>
      )}

      {(canManageDocs || canManagePayments) && (
        <SectionTabs
          value={tab}
          onValueChange={(v) => setTab(v as any)}
          tabs={[
            {
              value: 'documents',
              label: 'Documents',
              count: documents.length,
              content: documents.length === 0 ? (
                <EmptyBlock
                  icon={FileText}
                  title="No documents yet"
                  description="Upload W-9s, insurance certificates, or contracts."
                  action={canManageDocs ? <Button size="sm" variant="outline" onClick={() => setDocDialog(true)}><Upload className="w-4 h-4 mr-1" /> Upload</Button> : undefined}
                />
              ) : (
                <div className="flex flex-col gap-1.5">
                  {documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center gap-2 py-2 px-1 border-b border-border/50 last:border-0">
                      <Badge variant="secondary" className="text-[10px] font-normal">{DOC_TYPE_LABEL[doc.doc_type] ?? doc.doc_type}</Badge>
                      <span className="flex-1 text-xs text-foreground truncate">{doc.file_name || doc.file_path.split('/').pop()}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{new Date(doc.uploaded_at).toLocaleDateString()}</span>
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
              ),
            },
            {
              value: 'payments',
              label: 'Payments',
              count: payments.length,
              content: (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Balance
                      </p>
                      <p className="text-lg font-semibold text-foreground tabular-nums mt-0.5">${balance.toFixed(2)}</p>
                      {oldestDue && <p className="text-[11px] text-muted-foreground">Oldest due: {oldestDue}</p>}
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                        <DollarSign className="w-3 h-3" /> Total paid
                      </p>
                      <p className="text-lg font-semibold text-foreground tabular-nums mt-0.5">${totalPaid.toFixed(2)}</p>
                    </div>
                  </div>

                  {payments.length === 0 ? (
                    <EmptyBlock
                      icon={DollarSign}
                      title="No payments yet"
                      description="Track weekly vendor payables here."
                      action={canManagePayments ? <Button size="sm" variant="outline" onClick={() => setPayDialog(true)}><Plus className="w-4 h-4 mr-1" /> Add payment</Button> : undefined}
                    />
                  ) : (
                    <div className="flex flex-col">
                      {(payments as any[]).map((p) => (
                        <div key={p.id} className="flex items-center gap-2 py-2 border-b border-border/50 last:border-0 text-xs flex-wrap">
                          <StatusPill variant={p.status === 'paid' ? 'success' : 'warning'}>
                            {p.status === 'paid' ? 'Paid' : 'Pending'}
                          </StatusPill>
                          <span className="font-semibold text-foreground tabular-nums">${Number(p.amount).toFixed(2)}</span>
                          <span className="text-muted-foreground">
                            Wk {p.week_ending_date ?? p.payment_date} · Due {p.due_date ?? '—'}
                            {p.status === 'paid' && p.paid_at && ` · Paid ${p.paid_at}`}
                          </span>
                          {p.status === 'paid' && p.proof_url && <ProofLink path={p.proof_url} />}
                          {p.note && <span className="flex-1 min-w-[100px] truncate text-muted-foreground">— {p.note}</span>}
                          <div className="ml-auto flex items-center gap-1">
                            {p.status === 'pending' && canManagePayments && (
                              <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setMarkPaid({ id: p.id, amount: Number(p.amount) })}>
                                Mark Paid
                              </Button>
                            )}
                            {canManagePayments && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Row actions">
                                    <MoreVertical className="w-3.5 h-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setEditPayment(p)}>
                                    <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeletePayment(p)}>
                                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}

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

      <AddVendorPaymentDialog
        open={payDialog}
        onOpenChange={setPayDialog}
        vendorId={id}
        vendorName={vendor?.company_name}
        onSaved={() => refetchPay()}
      />

      <MarkPaidDialog
        open={!!markPaid}
        onOpenChange={(o) => !o && setMarkPaid(null)}
        paymentId={markPaid?.id ?? null}
        vendorId={id}
        amount={markPaid?.amount}
        onSaved={() => { refetchPay(); setMarkPaid(null); }}
      />

      <EditVendorPaymentDialog
        open={!!editPayment}
        onOpenChange={(o) => !o && setEditPayment(null)}
        payment={editPayment}
        onSaved={() => { refetchPay(); setEditPayment(null); }}
      />

      <AlertDialog open={!!deletePayment} onOpenChange={(o) => !o && !deleting && setDeletePayment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment entry?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!deletePayment) return;
                setDeleting(true);
                try {
                  if (deletePayment.proof_url) {
                    await supabase.storage.from('vendor-documents').remove([deletePayment.proof_url]).catch(() => {});
                  }
                  const { error } = await supabase.from('vendor_payments').delete().eq('id', deletePayment.id);
                  if (error) { toast.error(error.message); return; }
                  toast.success('Payment deleted');
                  setDeletePayment(null);
                  refetchPay();
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VendorDetail;
