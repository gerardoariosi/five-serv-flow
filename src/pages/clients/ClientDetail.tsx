import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Mail, Phone, Edit } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import Spinner from '@/components/ui/Spinner';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('properties');
  const [noteText, setNoteText] = useState('');
  const queryClient = useQueryClient();
  const { user, activeRole } = useAuthStore();
  const canSeeNotes = activeRole === 'admin' || activeRole === 'supervisor';

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: properties } = useQuery({
    queryKey: ['client-properties', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('properties').select('*').eq('current_pm_id', id!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id && activeTab === 'properties',
  });

  const { data: tickets } = useQuery({
    queryKey: ['client-tickets', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('tickets').select('*, properties(name)').eq('client_id', id!).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id && activeTab === 'tickets',
  });

  const { data: inspections } = useQuery({
    queryKey: ['client-inspections', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('inspections').select('*, properties(name)').eq('client_id', id!).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id && activeTab === 'inspections',
  });

  const { data: notes } = useQuery({
    queryKey: ['client-notes', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_notes')
        .select('id, note, created_at, created_by, users:created_by(full_name)')
        .eq('client_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id && activeTab === 'notes' && canSeeNotes,
  });

  const addNote = useMutation({
    mutationFn: async (text: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase.from('client_notes').insert({
        client_id: id!,
        note: text,
        created_by: user.id,
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

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <button onClick={() => navigate('/clients')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Clients
      </button>

      {/* Header */}
      <div className="bg-card border border-border rounded-lg p-5 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-bold text-foreground">{client.company_name}</h1>
              <Badge variant="outline">{client.type === 'pm' ? 'Property Manager' : 'Residential'}</Badge>
            </div>
            <div className="flex flex-col gap-1 text-sm text-muted-foreground ml-7">
              {client.contact_name && <span>{client.contact_name}</span>}
              {client.email && <a href={`mailto:${client.email}`} className="flex items-center gap-1 hover:text-primary"><Mail className="w-3 h-3" />{client.email}</a>}
              {client.phone && <a href={`tel:${client.phone}`} className="flex items-center gap-1 hover:text-primary"><Phone className="w-3 h-3" />{client.phone}</a>}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(`/clients/${id}/edit`)}>
            <Edit className="w-4 h-4 mr-1" /> Edit
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary w-full justify-start">
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="inspections">Inspections</TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="mt-4">
          <Button size="sm" className="mb-4 bg-primary text-primary-foreground" onClick={() => navigate(`/properties/new?client_id=${id}`)}>
            Add Property
          </Button>
          {properties?.length === 0 ? <p className="text-muted-foreground text-sm">No properties.</p> : (
            <div className="flex flex-col gap-2">
              {properties?.map(p => (
                <div key={p.id} onClick={() => navigate(`/properties/${p.id}`)} className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/30 transition-colors">
                  <span className="font-medium text-foreground">{p.name || p.address}</span>
                  <p className="text-sm text-muted-foreground">{p.address}</p>
                  {p.previous_pm_id && p.pm_changed_at && (
                    <p className="text-xs text-primary mt-1">Previous PM until {new Date(p.pm_changed_at).toLocaleDateString()}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tickets" className="mt-4">
          {tickets?.length === 0 ? <p className="text-muted-foreground text-sm">No tickets.</p> : (
            <div className="flex flex-col gap-2">
              {tickets?.map(t => (
                <div key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{t.fs_number || 'Draft'}</span>
                    <Badge variant="outline" className="text-xs">{t.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{(t as any).properties?.name} · {t.work_type}</p>
                  <p className="text-xs text-muted-foreground">{new Date(t.created_at!).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="inspections" className="mt-4">
          {inspections?.length === 0 ? <p className="text-muted-foreground text-sm">No inspections.</p> : (
            <div className="flex flex-col gap-2">
              {inspections?.map(ins => (
                <div key={ins.id} className="bg-card border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{ins.ins_number || 'Draft'}</span>
                    <Badge variant="outline" className="text-xs">{ins.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{(ins as any).properties?.name}</p>
                  {ins.visit_date && <p className="text-xs text-muted-foreground">Visit: {ins.visit_date}</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientDetail;
