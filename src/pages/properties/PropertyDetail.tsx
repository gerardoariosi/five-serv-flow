import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Edit, Plus, Save, Ticket, History, ClipboardCheck, Navigation, FileDown, Image as ImageIcon, Receipt } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatAddress } from '@/lib/propertyAddress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import Spinner from '@/components/ui/Spinner';
import PropertyDocumentsSections from '@/components/properties/PropertyDocumentsSections';
import { generatePropertyReportPdf } from '@/lib/propertyReportPdf';
import DetailHeader from '@/components/detail/DetailHeader';
import DetailActions from '@/components/detail/DetailActions';
import FieldGroup from '@/components/detail/FieldGroup';
import FieldRow from '@/components/detail/FieldRow';
import SectionTabs from '@/components/detail/SectionTabs';
import EmptyBlock from '@/components/detail/EmptyBlock';
import StatusPill from '@/components/detail/StatusPill';

const PropertyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeRole, user } = useAuthStore();
  const canManage = activeRole === 'admin' || activeRole === 'supervisor';
  const canSeeNotes = canManage;
  const [activeTab, setActiveTab] = useState('active');
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [paintNotes, setPaintNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const { data: property, isLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('properties')
        .select('*, zones(name), clients!properties_current_pm_id_fkey(id, company_name), prev_pm:clients!properties_previous_pm_id_fkey(company_name)')
        .eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: activeTickets = [] } = useQuery({
    queryKey: ['property-active-tickets', id],
    queryFn: async () => {
      const { data } = await supabase.from('tickets').select('*').eq('property_id', id!).not('status', 'in', '("closed","cancelled")').order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: closedTickets = [] } = useQuery({
    queryKey: ['property-history', id],
    queryFn: async () => {
      const { data } = await supabase.from('tickets').select('*').eq('property_id', id!).in('status', ['closed', 'cancelled']).order('closed_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: inspections = [] } = useQuery({
    queryKey: ['property-inspections', id],
    queryFn: async () => {
      const { data } = await supabase.from('inspections').select('*').eq('property_id', id!).order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: propertyNote } = useQuery({
    queryKey: ['property-notes', id],
    queryFn: async () => {
      const { data } = await supabase.from('property_notes' as any).select('*').eq('property_id', id!).maybeSingle();
      return data as any;
    },
    enabled: !!id && canSeeNotes,
  });

  const { data: propertyDocs = [] } = useQuery({
    queryKey: ['property-documents', id],
    queryFn: async () => {
      const { data } = await supabase.from('property_documents' as any).select('*').eq('property_id', id!).order('created_at', { ascending: false });
      return (data ?? []) as any[];
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (propertyNote) {
      setTenantName(propertyNote.tenant_name ?? '');
      setTenantPhone(propertyNote.tenant_phone ?? '');
      setGeneralNotes(propertyNote.notes ?? '');
      setPaintNotes(propertyNote.paint_notes ?? '');
    }
  }, [propertyNote]);

  const saveNotes = async () => {
    if (!id || !user?.id) return;
    setSavingNotes(true);
    const payload: any = {
      property_id: id,
      tenant_name: tenantName || null,
      tenant_phone: tenantPhone || null,
      notes: generalNotes || null,
      paint_notes: paintNotes || null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('property_notes' as any).upsert(payload, { onConflict: 'property_id' });
    setSavingNotes(false);
    if (error) { toast.error(error.message || 'Failed to save notes'); return; }
    toast.success('Notes saved');
    queryClient.invalidateQueries({ queryKey: ['property-notes', id] });
  };

  const handleDownloadReport = async () => {
    if (!property) return;
    try {
      toast.loading('Generating report…', { id: 'prop-report' });
      const galleryDocs = propertyDocs.filter((d: any) => d.kind === 'gallery');
      const estimateDocs = propertyDocs.filter((d: any) => d.kind === 'estimate_invoice');
      const allTickets = [...activeTickets, ...closedTickets];
      await generatePropertyReportPdf({
        property: {
          address: formatAddress(property as any),
          zoneName: (property.zones as any)?.name,
          currentPm: (property.clients as any)?.company_name,
          previousPm: (property.prev_pm as any)?.company_name,
          pmChangedAt: property.pm_changed_at,
        },
        notes: generalNotes,
        paintNotes: paintNotes,
        tickets: allTickets.map((t: any) => ({
          fs_number: t.fs_number,
          work_type: t.work_type,
          status: t.status,
          date: t.closed_at ?? t.created_at,
          summary: t.evaluation_description ?? null,
        })),
        inspections: inspections.map((ins: any) => ({
          ins_number: ins.ins_number,
          visit_date: ins.visit_date,
          status: ins.status,
        })),
        gallery: galleryDocs.map((d: any) => ({ file_name: d.file_name, created_at: d.created_at })),
        estimates: estimateDocs.map((d: any) => ({ file_name: d.file_name, created_at: d.created_at })),
      });
      toast.success('Report downloaded', { id: 'prop-report' });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to generate report', { id: 'prop-report' });
    }
  };


  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (!property) return <p className="text-center text-muted-foreground py-12">Property not found.</p>;

  const pm = property.clients as any;
  const prevPm = property.prev_pm as any;
  const address = formatAddress(property as any);
  const displayName = address || property.name || 'Unnamed property';
  const zoneName = (property.zones as any)?.name;

  const pmChangedRecent = property.pm_changed_at && (Date.now() - new Date(property.pm_changed_at).getTime()) < 60 * 24 * 60 * 60 * 1000;
  const status = pmChangedRecent ? <StatusPill variant="warning">PM changed</StatusPill> : null;

  const subline = [
    zoneName ? `Zone: ${zoneName}` : null,
    pm?.company_name ? `PM: ${pm.company_name}` : null,
  ].filter(Boolean).join(' · ');

  const primary = (
    <Button size="sm" onClick={() => navigate(`/tickets/new?property_id=${id}`)}>
      <Plus className="w-4 h-4 mr-1" /> New Ticket
    </Button>
  );

  const ghost = (
    <>
      <Button variant="ghost" size="sm" onClick={() => navigate(`/inspections/new?property_id=${id}`)}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Inspection
      </Button>
      {address && (
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <a href={`https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" aria-label="Directions">
            <Navigation className="w-4 h-4" />
          </a>
        </Button>
      )}
    </>
  );

  const overflow = (
    <>
      <DropdownMenuItem onClick={handleDownloadReport}>
        <FileDown className="w-4 h-4 mr-2" /> Download Report
      </DropdownMenuItem>
      {canManage && (
        <DropdownMenuItem onClick={() => navigate(`/properties/${id}/edit`)}>
          <Edit className="w-4 h-4 mr-2" /> Edit
        </DropdownMenuItem>
      )}
    </>
  );

  return (
    <div className="p-4 max-w-3xl mx-auto pb-16">
      <DetailHeader
        backTo="/properties"
        icon={<MapPin className="w-4 h-4" />}
        name={displayName}
        subline={subline || undefined}
        status={status}
        actions={<DetailActions primary={primary} ghost={ghost} overflow={overflow} />}
      />

      <FieldGroup label="Location" first>
        <FieldRow label="Address" value={address} />
        <FieldRow label="Zone" value={zoneName} />
      </FieldGroup>

      <FieldGroup label="Property Management">
        <FieldRow label="Current PM" value={pm?.company_name} />
        {prevPm?.company_name && (
          <FieldRow
            label="Previous PM"
            value={<span>{prevPm.company_name}{property.pm_changed_at ? ` (until ${new Date(property.pm_changed_at).toLocaleDateString()})` : ''}</span>}
          />
        )}
      </FieldGroup>

      {canSeeNotes && (
        <FieldGroup
          label="Tenant & Internal Notes"
          action={
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={saveNotes} disabled={savingNotes}>
              {savingNotes ? <Spinner size="sm" /> : (<><Save className="w-3 h-3 mr-1" /> Save</>)}
            </Button>
          }
        >
          <div className="grid grid-cols-[110px_1fr] gap-3 py-1.5 items-center">
            <label className="text-xs text-muted-foreground">Tenant name</label>
            <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-3 py-1.5 items-center">
            <label className="text-xs text-muted-foreground">Tenant phone</label>
            <Input value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} placeholder="(555) 123-4567" className="h-8 text-sm" />
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-3 py-1.5 items-start">
            <label className="text-xs text-muted-foreground pt-1">Notes</label>
            <Textarea value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} rows={3} className="text-sm" />
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-3 py-1.5 items-start">
            <label className="text-xs text-muted-foreground pt-1">Paint &amp; More</label>
            <Textarea
              value={paintNotes}
              onChange={(e) => setPaintNotes(e.target.value)}
              rows={3}
              placeholder="Paint codes/brands, flooring type, or other spec info…"
              className="text-sm"
            />
          </div>
          {propertyNote?.updated_at && (
            <p className="text-[11px] text-muted-foreground mt-1">Last updated: {new Date(propertyNote.updated_at).toLocaleString()}</p>
          )}
        </FieldGroup>
      )}

      <div className="mt-6">
        <SectionTabs
          value={activeTab}
          onValueChange={setActiveTab}
          tabs={[
            {
              value: 'active',
              label: 'Active',
              count: activeTickets.length,
              content: activeTickets.length === 0 ? (
                <EmptyBlock icon={Ticket} title="No active tickets" description="Open work orders will appear here." />
              ) : (
                <div className="flex flex-col">
                  {activeTickets.map(t => (
                    <button key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} className="w-full text-left py-3 px-1 border-b border-border/50 last:border-0 hover:bg-muted/30">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm text-foreground truncate">{t.fs_number || 'Draft'}</span>
                        <Badge variant="outline" className="text-[10px] font-normal">{t.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{t.work_type} · {t.priority}</p>
                    </button>
                  ))}
                </div>
              ),
            },
            {
              value: 'history',
              label: 'History',
              count: closedTickets.length,
              content: closedTickets.length === 0 ? (
                <EmptyBlock icon={History} title="No history" />
              ) : (
                <div className="flex flex-col">
                  {closedTickets.map(t => (
                    <button key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} className="w-full text-left py-3 px-1 border-b border-border/50 last:border-0 hover:bg-muted/30">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm text-foreground truncate">{t.fs_number}</span>
                        <Badge variant="outline" className="text-[10px] font-normal">{t.status}</Badge>
                      </div>
                      {t.closed_at && <p className="text-[11px] text-muted-foreground">Closed: {new Date(t.closed_at).toLocaleDateString()}</p>}
                    </button>
                  ))}

                </div>
              ),
            },
            {
              value: 'inspections',
              label: 'Inspections',
              count: inspections.length,
              content: inspections.length === 0 ? (
                <EmptyBlock icon={ClipboardCheck} title="No inspections" />
              ) : (
                <div className="flex flex-col">
                  {inspections.map(ins => (
                    <button key={ins.id} onClick={() => navigate(`/inspections/${ins.id}`)} className="w-full text-left py-3 px-1 border-b border-border/50 last:border-0 hover:bg-muted/30">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm text-foreground truncate">{ins.ins_number || 'Draft'}</span>
                        <Badge variant="outline" className="text-[10px] font-normal">{ins.status}</Badge>
                      </div>
                      {ins.visit_date && <p className="text-[11px] text-muted-foreground">Visit: {ins.visit_date}</p>}
                    </button>
                  ))}

                </div>
              ),
            },
          ]}
        />
      </div>

      {id && (
        <div className="mt-8">
          <PropertyDocumentsSections propertyId={id} />
        </div>
      )}
    </div>
  );
};

export default PropertyDetail;
