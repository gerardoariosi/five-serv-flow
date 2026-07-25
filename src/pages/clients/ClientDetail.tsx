import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, Mail, Phone, Edit, Upload, Plus, FolderOpen, Ticket, ClipboardCheck, StickyNote } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import Spinner from '@/components/ui/Spinner';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import ImportPropertiesDialog from '@/components/properties/ImportPropertiesDialog';
import DetailHeader from '@/components/detail/DetailHeader';
import DetailActions from '@/components/detail/DetailActions';
import FieldGroup from '@/components/detail/FieldGroup';
import FieldRow from '@/components/detail/FieldRow';
import SectionTabs from '@/components/detail/SectionTabs';
import EmptyBlock from '@/components/detail/EmptyBlock';
import StatusPill from '@/components/detail/StatusPill';

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('properties');
  const [importOpen, setImportOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const queryClient = useQueryClient();
  const { user, activeRole } = useAuthStore();
  const canManage = activeRole === 'admin' || activeRole === 'supervisor';
  const canSeeNotes = canManage;

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['client-properties', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('properties').select('*').eq('current_pm_id', id!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['client-tickets', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('tickets').select('*, properties(name)').eq('client_id', id!).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: inspections = [] } = useQuery({
    queryKey: ['client-inspections', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('inspections').select('*, properties(name)').eq('client_id', id!).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ['client-notes', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('client_notes')
        .select('id, note, created_at, created_by, users:created_by(full_name)')
        .eq('client_id', id!).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id && canSeeNotes,
  });

  const addNote = useMutation({
    mutationFn: async (text: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase.from('client_notes').insert({
        client_id: id!, note: text, created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNoteText('');
      queryClient.invalidateQueries({ queryKey: ['client-notes', id] });
      toast.success('Note saved');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save note'),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (!client) return <p className="text-center text-muted-foreground py-12">Client not found.</p>;

  const status = (
    <StatusPill variant="info">{client.type === 'pm' ? 'Property Manager' : 'Residential'}</StatusPill>
  );

  const subline = [
    client.contact_name,
    `${properties.length} ${properties.length === 1 ? 'property' : 'properties'}`,
  ].filter(Boolean).join(' · ');

  const primary = canManage ? (
    <Button size="sm" onClick={() => navigate(`/properties/new?client_id=${id}`)}>
      <Plus className="w-4 h-4 mr-1" /> Add Property
    </Button>
  ) : null;

  const ghost = (
    <>
      {client.email && (
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <a href={`mailto:${client.email}`} aria-label="Email"><Mail className="w-4 h-4" /></a>
        </Button>
      )}
      {client.phone && (
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <a href={`tel:${client.phone}`} aria-label="Call"><Phone className="w-4 h-4" /></a>
        </Button>
      )}
    </>
  );

  const overflow = canManage ? (
    <>
      <DropdownMenuItem onClick={() => setImportOpen(true)}>
        <Upload className="w-4 h-4 mr-2" /> Import properties (CSV)
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => navigate(`/clients/${id}/edit`)}>
        <Edit className="w-4 h-4 mr-2" /> Edit
      </DropdownMenuItem>
    </>
  ) : null;

  const tabs: any[] = [
    {
      value: 'properties',
      label: 'Properties',
      count: properties.length,
      content: properties.length === 0 ? (
        <EmptyBlock
          icon={FolderOpen}
          title="No properties yet"
          description="Add a property or import multiple via CSV."
          action={canManage ? (
            <Button size="sm" variant="outline" onClick={() => navigate(`/properties/new?client_id=${id}`)}>
              <Plus className="w-4 h-4 mr-1" /> Add Property
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="flex flex-col">
          {properties.map(p => (
            <button
              key={p.id}
              onClick={() => navigate(`/properties/${p.id}`)}
              className="w-full text-left py-3 px-1 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
            >
              <p className="font-medium text-sm text-foreground truncate">{p.name || p.address}</p>
              <p className="text-xs text-muted-foreground truncate">{p.address}</p>
              {p.previous_pm_id && p.pm_changed_at && (
                <p className="text-[11px] text-primary mt-0.5">Previous PM until {new Date(p.pm_changed_at).toLocaleDateString()}</p>
              )}
            </button>
          ))}
        </div>
      ),
    },
    {
      value: 'tickets',
      label: 'Tickets',
      count: tickets.length,
      content: tickets.length === 0 ? (
        <EmptyBlock icon={Ticket} title="No tickets" description="Work orders for this client will appear here." />
      ) : (
        <div className="flex flex-col">
          {tickets.map(t => (
            <button
              key={t.id}
              onClick={() => navigate(`/tickets/${t.id}`)}
              className="w-full text-left py-3 px-1 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm text-foreground truncate">{t.fs_number || 'Draft'}</span>
                <Badge variant="outline" className="text-[10px] font-normal">{t.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">{(t as any).properties?.name} · {t.work_type}</p>
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
            <button
              key={ins.id}
              onClick={() => navigate(`/inspections/${ins.id}`)}
              className="w-full text-left py-3 px-1 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm text-foreground truncate">{ins.ins_number || 'Draft'}</span>
                <Badge variant="outline" className="text-[10px] font-normal">{ins.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">{(ins as any).properties?.name}</p>
              {ins.visit_date && <p className="text-[11px] text-muted-foreground">Visit: {ins.visit_date}</p>}
            </button>
          ))}

        </div>
      ),
    },
  ];

  if (canSeeNotes) {
    tabs.push({
      value: 'notes',
      label: 'Notes',
      count: notes.length,
      content: (
        <div className="space-y-4">
          <div>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add an internal note about this client…"
              rows={3}
            />
            <div className="flex justify-end mt-2">
              <Button
                size="sm"
                disabled={!noteText.trim() || addNote.isPending}
                onClick={() => addNote.mutate(noteText.trim())}
              >
                {addNote.isPending ? 'Saving…' : 'Save Note'}
              </Button>
            </div>
          </div>
          {notes.length === 0 ? (
            <EmptyBlock icon={StickyNote} title="No notes yet" description="Internal notes are only visible to admins and supervisors." />
          ) : (
            <div className="flex flex-col">
              {notes.map((n: any) => (
                <div key={n.id} className="py-3 border-b border-border/50 last:border-0">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{n.note}</p>
                  <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted-foreground">
                    <span>{n.users?.full_name || 'Unknown'}</span>
                    <span>{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    });
  }

  return (
    <div className="p-4 max-w-3xl mx-auto pb-16">
      <DetailHeader
        backTo="/clients"
        icon={<Building2 className="w-4 h-4" />}
        name={client.company_name}
        subline={subline || undefined}
        status={status}
        actions={<DetailActions primary={primary} ghost={ghost} overflow={overflow} />}
      />

      <FieldGroup label="Contact" first>
        <FieldRow label="Contact" value={client.contact_name} />
        <FieldRow label="Email" value={client.email ? <a href={`mailto:${client.email}`} className="hover:text-primary break-all">{client.email}</a> : null} />
        <FieldRow label="Phone" value={client.phone ? <a href={`tel:${client.phone}`} className="hover:text-primary">{client.phone}</a> : null} />
      </FieldGroup>

      {((client as any).referred_by || (client as any).lead_source) && (
        <FieldGroup label="Source">
          <FieldRow label="Referred by" value={(client as any).referred_by} />
          <FieldRow label="Lead source" value={(client as any).lead_source ? <span className="capitalize">{(client as any).lead_source}</span> : null} />
        </FieldGroup>
      )}

      <div className="mt-6">
        <SectionTabs value={activeTab} onValueChange={setActiveTab} tabs={tabs} />
      </div>

      {id && <ImportPropertiesDialog open={importOpen} onOpenChange={setImportOpen} clientId={id} />}
    </div>
  );
};

export default ClientDetail;
