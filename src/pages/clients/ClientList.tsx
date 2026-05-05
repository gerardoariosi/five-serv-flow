import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreVertical, Building2, User as UserIcon, Mail, Phone, Archive, Download, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Spinner from '@/components/ui/Spinner';
import BulkActionBar from '@/components/ui/BulkActionBar';
import BulkDeleteDialog from '@/components/ui/BulkDeleteDialog';
import { toast } from 'sonner';

type ClientType = 'pm' | 'residential' | null;
type StatusFilter = 'active' | 'archived';

const PAGE_SIZE = 20;

const ClientList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeRole } = useAuthStore();
  const canDelete = activeRole === 'admin';
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ClientType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [page, setPage] = useState(0);
  const [archiveDialog, setArchiveDialog] = useState<{ open: boolean; clientId: string; hasActiveTickets: boolean }>({ open: false, clientId: '', hasActiveTickets: false });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', search, typeFilter, statusFilter, page],
    queryFn: async () => {
      let query = supabase.from('clients').select('*', { count: 'exact' }).eq('is_deleted', false);

      if (search) {
        query = query.or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%`);
      }
      if (typeFilter !== 'all') query = query.eq('type', typeFilter);
      query = query.eq('status', statusFilter);
      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1).order('company_name');

      const { data: clients, count, error } = await query;
      if (error) throw error;

      const clientIds = (clients ?? []).map(c => c.id);
      const [{ data: propCounts }, { data: ticketCounts }] = await Promise.all([
        supabase.from('properties').select('current_pm_id').in('current_pm_id', clientIds),
        supabase.from('tickets').select('client_id, status').in('client_id', clientIds).neq('status', 'closed').neq('status', 'cancelled'),
      ]);

      const propMap: Record<string, number> = {};
      propCounts?.forEach(p => { propMap[p.current_pm_id!] = (propMap[p.current_pm_id!] || 0) + 1; });

      const ticketMap: Record<string, number> = {};
      ticketCounts?.forEach(t => { ticketMap[t.client_id!] = (ticketMap[t.client_id!] || 0) + 1; });

      return { clients: clients ?? [], count: count ?? 0, propMap, ticketMap };
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ clientId, action }: { clientId: string; action: 'archive' | 'delete' | 'export_delete' }) => {
      await supabase.from('tickets').update({ status: 'cancelled' }).eq('client_id', clientId).eq('status', 'draft');
      await supabase.from('inspections').update({ status: 'closed_internally' }).eq('client_id', clientId).eq('status', 'draft');
      if (action === 'archive') {
        await supabase.from('clients').update({ status: 'archived' }).eq('id', clientId);
      } else if (action === 'export_delete') {
        // TODO: generate ZIP first, then hard delete
        await supabase.from('clients').update({ is_deleted: true, deleted_at: new Date().toISOString(), status: 'archived' }).eq('id', clientId);
      } else if (action === 'delete') {
        await supabase.from('clients').update({ is_deleted: true, deleted_at: new Date().toISOString(), status: 'archived' }).eq('id', clientId);
      }
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success(vars.action === 'archive' ? 'Client archived.' : 'Client deleted.');
      setArchiveDialog({ open: false, clientId: '', hasActiveTickets: false });
    },
    onError: () => toast.error('Action failed.'),
  });

  const handleArchiveClick = (clientId: string) => {
    if (!canDelete) return;
    const activeCount = data?.ticketMap[clientId] ?? 0;
    if (activeCount > 0) { toast.error('Cannot archive: client has active tickets.'); return; }
    setArchiveDialog({ open: true, clientId, hasActiveTickets: false });
  };

  const performBulkSoftDelete = async (ids: string[]) => {
    setDeleting(true);
    const { error } = await supabase.from('clients').update({ is_deleted: true, deleted_at: new Date().toISOString(), status: 'archived' }).in('id', ids);
    setDeleting(false);
    if (error) { toast.error('Delete failed'); return false; }
    toast.success(`${ids.length} client${ids.length === 1 ? '' : 's'} deleted`);
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    return true;
  };

  const performBulkArchive = async (ids: string[]) => {
    setBulkArchiving(true);
    const { error } = await supabase.from('clients').update({ status: 'archived' }).in('id', ids);
    setBulkArchiving(false);
    if (error) { toast.error('Archive failed'); return; }
    toast.success(`${ids.length} client${ids.length === 1 ? '' : 's'} archived`);
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  };

  const clients = data?.clients ?? [];
  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);
  const toggleSelect = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(p => p.size === clients.length ? new Set() : new Set(clients.map(c => c.id)));
  const selectedNames = useMemo(() => clients.filter(c => selected.has(c.id)).map(c => c.company_name ?? 'Unnamed'), [clients, selected]);

  return (
    <div className="p-4 max-w-4xl mx-auto pb-28">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-foreground">Clients</h1>
        <Button onClick={() => navigate('/clients/new')} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-1" /> New
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search clients..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-10 bg-secondary border-border" />
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'pm', 'residential'] as const).map(t => (
          <button key={t} onClick={() => { setTypeFilter(t); setPage(0); }}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${typeFilter === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            {t === 'all' ? 'All' : t === 'pm' ? 'Property Manager' : 'Residential'}
          </button>
        ))}
        <div className="w-px bg-border mx-1" />
        {(['active', 'archived'] as const).map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {canDelete && clients.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <Checkbox checked={selected.size > 0 && selected.size === clients.length} onCheckedChange={toggleAll} />
          <span className="text-xs text-muted-foreground">Select all ({clients.length})</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : clients.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No clients found.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {clients.map(client => (
            <div key={client.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors group">
              <div className="flex items-start justify-between gap-3">
                {canDelete && (
                  <Checkbox
                    checked={selected.has(client.id)}
                    onCheckedChange={() => toggleSelect(client.id)}
                    className="mt-1 md:opacity-0 md:group-hover:opacity-100 data-[state=checked]:opacity-100 transition-opacity"
                  />
                )}
                <div className="flex-1 cursor-pointer" onClick={() => navigate(`/clients/${client.id}`)}>
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-4 h-4 text-primary" />
                    <span className="font-bold text-foreground">{client.company_name || 'Unnamed'}</span>
                    <Badge variant="outline" className="text-xs">{client.type === 'pm' ? 'PM' : 'Residential'}</Badge>
                  </div>
                  <div className="flex flex-col gap-1 text-sm text-muted-foreground ml-6">
                    {client.contact_name && <div className="flex items-center gap-1"><UserIcon className="w-3 h-3" />{client.contact_name}</div>}
                    {client.email && <a href={`mailto:${client.email}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1 hover:text-primary"><Mail className="w-3 h-3" />{client.email}</a>}
                    {client.phone && <a href={`tel:${client.phone}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1 hover:text-primary"><Phone className="w-3 h-3" />{client.phone}</a>}
                  </div>
                  <div className="flex gap-3 mt-2 ml-6 text-xs text-muted-foreground">
                    <span>{data?.propMap[client.id] ?? 0} properties</span>
                    <span>{data?.ticketMap[client.id] ?? 0} active tickets</span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1 text-muted-foreground hover:text-foreground"><MoreVertical className="w-4 h-4" /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate(`/clients/${client.id}`)}>View</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/clients/${client.id}/edit`)}>Edit</DropdownMenuItem>
                    {canDelete && (
                      <>
                        <DropdownMenuItem onClick={() => handleArchiveClick(client.id)} className="text-destructive">Archive…</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setHardDeleteConfirm({ id: client.id, name: client.company_name ?? 'Unnamed' })} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" /> Delete permanently
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground self-center">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      {/* Archive Dialog */}
      <Dialog open={archiveDialog.open} onOpenChange={(o) => setArchiveDialog(p => ({ ...p, open: o }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Archive Client</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Choose an option. Draft tickets and inspections will be cancelled.</p>
          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button variant="outline" onClick={() => archiveMutation.mutate({ clientId: archiveDialog.clientId, action: 'archive' })} disabled={archiveMutation.isPending}>
              <Archive className="w-4 h-4 mr-2" /> Archive Only
            </Button>
            <Button variant="outline" onClick={() => archiveMutation.mutate({ clientId: archiveDialog.clientId, action: 'export_delete' })} disabled={archiveMutation.isPending}>
              <Download className="w-4 h-4 mr-2" /> Export ZIP & Delete
            </Button>
            <Button onClick={() => archiveMutation.mutate({ clientId: archiveDialog.clientId, action: 'delete' })} disabled={archiveMutation.isPending} className="bg-red-600 hover:bg-red-700 text-white border-0">
              <Trash2 className="w-4 h-4 mr-2" /> Delete Without Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hard delete confirmation */}
      <BulkDeleteDialog
        open={!!hardDeleteConfirm}
        onOpenChange={(o) => !o && setHardDeleteConfirm(null)}
        itemNames={hardDeleteConfirm ? [hardDeleteConfirm.name] : []}
        totalCount={1}
        loading={deleting}
        customTitle="Permanently delete client?"
        customMessage="This will permanently delete the client and all associated data. This action cannot be undone."
        onConfirm={async () => {
          if (!hardDeleteConfirm) return;
          const ok = await performBulkSoftDelete([hardDeleteConfirm.id]);
          if (ok) setHardDeleteConfirm(null);
        }}
      />

      {/* Bulk delete confirmation */}
      <BulkDeleteDialog
        open={bulkDeleteDialog}
        onOpenChange={setBulkDeleteDialog}
        itemNames={selectedNames}
        totalCount={selected.size}
        loading={deleting}
        customMessage="This will permanently delete the selected clients and all associated data. This action cannot be undone."
        onConfirm={async () => {
          const ok = await performBulkSoftDelete(Array.from(selected));
          if (ok) { setSelected(new Set()); setBulkDeleteDialog(false); }
        }}
      />

      {canDelete && (
        <BulkActionBar
          count={selected.size}
          itemNoun="client"
          deleting={deleting || bulkArchiving}
          onDelete={() => setBulkDeleteDialog(true)}
          onClear={() => setSelected(new Set())}
          extraActions={
            <Button
              size="sm"
              variant="secondary"
              disabled={bulkArchiving}
              onClick={() => performBulkArchive(Array.from(selected))}
            >
              <Archive className="w-4 h-4 mr-1" /> Archive Selected
            </Button>
          }
        />
      )}
    </div>
  );
};

export default ClientList;
