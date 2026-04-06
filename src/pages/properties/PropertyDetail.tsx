import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Edit, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Spinner from '@/components/ui/Spinner';

const PropertyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('active');

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

  const { data: activeTickets } = useQuery({
    queryKey: ['property-active-tickets', id],
    queryFn: async () => {
      const { data } = await supabase.from('tickets').select('*').eq('property_id', id!).not('status', 'in', '("closed","cancelled")').order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!id && activeTab === 'active',
  });

  const { data: closedTickets } = useQuery({
    queryKey: ['property-history', id],
    queryFn: async () => {
      const { data } = await supabase.from('tickets').select('*').eq('property_id', id!).in('status', ['closed', 'cancelled']).order('closed_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!id && activeTab === 'history',
  });

  const { data: inspections } = useQuery({
    queryKey: ['property-inspections', id],
    queryFn: async () => {
      const { data } = await supabase.from('inspections').select('*').eq('property_id', id!).order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!id && activeTab === 'inspections',
  });

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (!property) return <p className="text-center text-muted-foreground py-12">Property not found.</p>;

  const pm = property.clients as any;
  const prevPm = property.prev_pm as any;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <button onClick={() => navigate('/properties')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Properties
      </button>

      <div className="bg-card border border-border rounded-lg p-5 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground mb-2">{property.name || property.address}</h1>
            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              <span>Zone: {(property.zones as any)?.name ?? 'None'}</span>
              <span>PM: {pm?.company_name ?? 'None'}</span>
              {prevPm?.company_name && property.pm_changed_at && (
                <span className="text-primary">Previous PM: {prevPm.company_name} until {new Date(property.pm_changed_at).toLocaleDateString()}</span>
              )}
              {property.address && (
                <a href={`https://maps.google.com/?q=${encodeURIComponent(property.address)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary">
                  <MapPin className="w-3 h-3" />{property.address}
                </a>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(`/properties/${id}/edit`)}>
            <Edit className="w-4 h-4 mr-1" /> Edit
          </Button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-4">
        <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => navigate(`/tickets/new?property_id=${id}`)}>
          <Plus className="w-4 h-4 mr-1" /> New Ticket
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate(`/inspections/new?property_id=${id}`)}>
          <Plus className="w-4 h-4 mr-1" /> New Inspection
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary w-full justify-start">
          <TabsTrigger value="active">Active Tickets</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="inspections">Inspections</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {activeTickets?.length === 0 ? <p className="text-muted-foreground text-sm">No active tickets.</p> : (
            <div className="flex flex-col gap-2">
              {activeTickets?.map(t => (
                <div key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/30">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{t.fs_number || 'Draft'}</span>
                    <Badge variant="outline" className="text-xs">{t.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{t.work_type} · {t.priority}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {closedTickets?.length === 0 ? <p className="text-muted-foreground text-sm">No history.</p> : (
            <div className="flex flex-col gap-2">
              {closedTickets?.map(t => (
                <div key={t.id} className="bg-card border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{t.fs_number}</span>
                    <Badge variant="outline" className="text-xs">{t.status}</Badge>
                  </div>
                  {t.closed_at && <p className="text-xs text-muted-foreground">Closed: {new Date(t.closed_at).toLocaleDateString()}</p>}
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

export default PropertyDetail;
