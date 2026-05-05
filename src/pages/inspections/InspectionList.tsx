import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, Plus, FileEdit, Clock, MoreVertical, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import BulkActionBar from '@/components/ui/BulkActionBar';
import BulkDeleteDialog from '@/components/ui/BulkDeleteDialog';
import { toast } from 'sonner';
import { inspectionStatusLabels, inspectionStatusColors } from '@/lib/inspectionColors';
import Spinner from '@/components/ui/Spinner';

const InspectionList = () => {
  const navigate = useNavigate();
  const { activeRole } = useAuthStore();
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [clients, setClients] = useState<Record<string, string>>({});
  const [properties, setProperties] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [iRes, cRes, pRes] = await Promise.all([
      supabase.from('inspections').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, company_name'),
      supabase.from('properties').select('id, name'),
    ]);
    setInspections(iRes.data ?? []);
    const cMap: Record<string, string> = {};
    (cRes.data ?? []).forEach((c: any) => { cMap[c.id] = c.company_name ?? ''; });
    setClients(cMap);
    const pMap: Record<string, string> = {};
    (pRes.data ?? []).forEach((p: any) => { pMap[p.id] = p.name ?? ''; });
    setProperties(pMap);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const drafts = useMemo(() => inspections.filter(i => i.status === 'draft'), [inspections]);
  const active = useMemo(() => {
    let result = inspections.filter(i => i.status !== 'draft');
    if (filterStatus !== 'all') result = result.filter(i => i.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.ins_number?.toLowerCase().includes(q) ||
        (i.client_id && clients[i.client_id]?.toLowerCase().includes(q)) ||
        (i.property_id && properties[i.property_id]?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [inspections, filterStatus, search, clients, properties]);

  const daysSinceSent = (sentDate: string | null) => {
    if (!sentDate) return 0;
    return Math.floor((Date.now() - new Date(sentDate).getTime()) / (1000 * 60 * 60 * 24));
  };

  const canDelete = activeRole === 'admin' || activeRole === 'supervisor';

  const handleDeleteInspection = async (ins: any) => {
    await supabase.from('inspection_items').delete().eq('inspection_id', ins.id);
    await supabase.from('inspection_photos').delete().eq('inspection_id', ins.id);
    await supabase.from('inspection_tickets').delete().eq('inspection_id', ins.id);
    await supabase.from('inspections').delete().eq('id', ins.id);
    toast.success('Inspection deleted');
    setDeleteTarget(null);
    fetchData();
  };

  const InspectionCard = ({ ins }: { ins: any }) => {
    const isSent = ins.status === 'sent';
    const isPmPending = isSent && !ins.pm_submitted_at;
    const daysPending = isSent ? daysSinceSent(ins.created_at) : 0;

    return (
      <div className="flex items-start gap-0">
        <button
          onClick={() => navigate(`/inspections/${ins.id}`)}
          className="flex-1 text-left p-4 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-bold text-foreground">{ins.ins_number ?? 'No INS#'}</span>
                <Badge className={`text-[10px] ${inspectionStatusColors[ins.status ?? 'draft']}`}>
                  {inspectionStatusLabels[ins.status ?? 'draft']}
                </Badge>
                {isPmPending && daysPending >= 2 && (
                  <Badge className="text-[10px] bg-yellow-500/20 text-yellow-400">
                    Pending Response · {daysPending}d
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {ins.property_id ? properties[ins.property_id] : '—'}
                {ins.client_id ? ` · ${clients[ins.client_id]}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              {ins.visit_date && (
                <p className="text-xs text-muted-foreground">
                  {new Date(ins.visit_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              )}
            </div>
          </div>
        </button>
        {canDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 mt-3 ml-1">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(ins); }}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 space-y-4">
      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deleteTarget?.status === 'draft' ? 'Delete Draft?' : 'Delete Inspection?'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteTarget?.status === 'draft'
              ? 'This will permanently delete this inspection draft and all its items.'
              : 'This inspection has been sent to PM. Are you sure you want to delete it? This action cannot be undone.'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && handleDeleteInspection(deleteTarget)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Inspections</h1>
        {(activeRole === 'admin' || activeRole === 'supervisor') && (
          <Button size="sm" onClick={() => navigate('/inspections/new')}>
            <Plus className="w-4 h-4 mr-1" /> New Inspection
          </Button>
        )}
      </div>

      <Tabs defaultValue="active">
        <TabsList className="w-full">
          <TabsTrigger value="drafts" className="flex-1">
            <FileEdit className="w-4 h-4 mr-1" /> Drafts ({drafts.length})
          </TabsTrigger>
          <TabsTrigger value="active" className="flex-1">
            <Clock className="w-4 h-4 mr-1" /> Active & Recent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="drafts" className="space-y-2 mt-4">
          {drafts.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No draft inspections</p>
          ) : (
            drafts.map(ins => <InspectionCard key={ins.id} ins={ins} />)
          )}
        </TabsContent>

        <TabsContent value="active" className="space-y-4 mt-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search inspections..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(inspectionStatusLabels).filter(([k]) => k !== 'draft').map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            {active.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">No inspections found</p>
            ) : (
              active.map(ins => <InspectionCard key={ins.id} ins={ins} />)
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InspectionList;
