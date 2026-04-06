import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, User, MoreVertical, Archive, RotateCcw } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

const TechnicianList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('technicians');

  const { data: technicians = [], refetch: refetchTechs } = useQuery({
    queryKey: ['technicians-vendors', 'technician'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('technicians_vendors')
        .select('*')
        .eq('type', 'technician')
        .order('contact_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: vendors = [], refetch: refetchVendors } = useQuery({
    queryKey: ['technicians-vendors', 'vendor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('technicians_vendors')
        .select('*')
        .eq('type', 'vendor')
        .order('company_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: activeTicketCounts = {} } = useQuery({
    queryKey: ['active-ticket-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('technician_id')
        .in('status', ['open', 'in_progress', 'paused']);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((t) => {
        if (t.technician_id) counts[t.technician_id] = (counts[t.technician_id] || 0) + 1;
      });
      return counts;
    },
  });

  const handleArchive = async (id: string, currentStatus: string, userId?: string | null) => {
    if (currentStatus === 'active') {
      const count = activeTicketCounts[userId ?? ''] || 0;
      if (count > 0) {
        toast.error('Cannot archive — technician has active tickets');
        return;
      }
    }
    const newStatus = currentStatus === 'active' ? 'archived' : 'active';
    const { error } = await supabase.from('technicians_vendors').update({ status: newStatus }).eq('id', id);
    if (error) { toast.error('Failed to update status'); return; }
    toast.success(newStatus === 'active' ? 'Restored' : 'Archived');
    refetchTechs();
    refetchVendors();
  };

  const filteredTechs = technicians.filter((t) => {
    const q = search.toLowerCase();
    return !q || t.contact_name?.toLowerCase().includes(q) || t.email?.toLowerCase().includes(q) || t.specialties?.some((s) => s.toLowerCase().includes(q));
  });

  const filteredVendors = vendors.filter((v) => {
    const q = search.toLowerCase();
    return !q || v.company_name?.toLowerCase().includes(q) || v.contact_name?.toLowerCase().includes(q) || v.email?.toLowerCase().includes(q);
  });

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Team</h1>
        <Button size="sm" onClick={() => navigate(tab === 'technicians' ? '/team/technicians/new' : '/team/vendors/new')}>
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="technicians" className="flex-1">Technicians ({technicians.length})</TabsTrigger>
          <TabsTrigger value="vendors" className="flex-1">Vendors ({vendors.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="technicians" className="space-y-2 mt-4">
          {filteredTechs.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No technicians found</p>}
          {filteredTechs.map((tech) => (
            <div key={tech.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card cursor-pointer hover:border-primary/40 transition-colors" onClick={() => navigate(`/team/technicians/${tech.id}`)}>
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{tech.contact_name || 'Unnamed'}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {tech.specialties?.slice(0, 3).map((s) => (
                    <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={tech.status === 'active' ? 'default' : 'outline'} className="text-[10px]">
                  {tech.status === 'active' ? 'Active' : 'Archived'}
                </Badge>
                <span className="text-xs text-muted-foreground">{activeTicketCounts[tech.user_id ?? ''] || 0} jobs</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => navigate(`/team/technicians/${tech.id}`)}>View / Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleArchive(tech.id, tech.status ?? 'active', tech.user_id)}>
                      {tech.status === 'active' ? <><Archive className="w-4 h-4 mr-2" /> Archive</> : <><RotateCcw className="w-4 h-4 mr-2" /> Restore</>}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="vendors" className="space-y-2 mt-4">
          {filteredVendors.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No vendors found</p>}
          {filteredVendors.map((vendor) => (
            <div key={vendor.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card cursor-pointer hover:border-primary/40 transition-colors" onClick={() => navigate(`/team/vendors/${vendor.id}`)}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{vendor.company_name || 'Unnamed'}</p>
                <p className="text-xs text-muted-foreground">{vendor.contact_name}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {vendor.specialties?.slice(0, 3).map((s) => (
                    <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={vendor.status === 'active' ? 'default' : 'outline'} className="text-[10px]">
                  {vendor.status === 'active' ? 'Active' : 'Archived'}
                </Badge>
                {vendor.license_number && <span className="text-[10px] text-muted-foreground">Lic: {vendor.license_number}</span>}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => navigate(`/team/vendors/${vendor.id}`)}>View / Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleArchive(vendor.id, vendor.status ?? 'active')}>
                      {vendor.status === 'active' ? <><Archive className="w-4 h-4 mr-2" /> Archive</> : <><RotateCcw className="w-4 h-4 mr-2" /> Restore</>}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TechnicianList;
