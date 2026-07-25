import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
} from '@/components/ui/dialog';
import Spinner from '@/components/ui/Spinner';

const PAGE_SIZE = 50;

const AuditLog = () => {
  const navigate = useNavigate();
  const { activeRole } = useAuthStore();
  const [table, setTable] = useState<string>('all');
  const [actor, setActor] = useState('');
  const [page, setPage] = useState(0);
  const [viewing, setViewing] = useState<any | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit_log', table, actor, page],
    queryFn: async () => {
      let q = supabase
        .from('audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (table !== 'all') q = q.eq('table_name', table);
      if (actor) q = q.ilike('actor_email', `%${actor}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
    enabled: activeRole === 'admin',
  });

  if (activeRole !== 'admin') {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="bg-card border border-border rounded-lg p-6 flex flex-col items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-destructive" />
          <p className="text-sm text-muted-foreground">Only admins can view the audit log.</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  return (
    <div className="p-4 max-w-5xl mx-auto pb-12">
      <button
        onClick={() => navigate('/settings')}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Settings
      </button>

      <h1 className="text-xl font-bold text-foreground mb-1">Audit Log</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Every change to clients, properties, tickets, and vendors — who did it and when.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Select value={table} onValueChange={(v) => { setTable(v); setPage(0); }}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tables</SelectItem>
            <SelectItem value="clients">Clients</SelectItem>
            <SelectItem value="properties">Properties</SelectItem>
            <SelectItem value="tickets">Tickets</SelectItem>
            <SelectItem value="technicians_vendors">Vendors / Users</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Filter by actor email…"
          value={actor}
          onChange={(e) => { setActor(e.target.value); setPage(0); }}
          className="sm:max-w-xs"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : error ? (
        <p className="text-sm text-destructive">Failed to load audit log.</p>
      ) : data?.rows.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No entries.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">When</th>
                <th className="text-left px-3 py-2 font-medium">Actor</th>
                <th className="text-left px-3 py-2 font-medium">Action</th>
                <th className="text-left px-3 py-2 font-medium">Table</th>
                <th className="text-left px-3 py-2 font-medium">Record</th>
                <th className="text-right px-3 py-2 font-medium">Changes</th>
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-secondary/40">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 truncate max-w-[200px]">{r.actor_email ?? '—'}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={
                        r.action === 'delete'
                          ? 'border-destructive/40 text-destructive'
                          : r.action === 'insert'
                          ? 'border-primary/40 text-primary'
                          : ''
                      }
                    >
                      {r.action}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.table_name}</td>
                  <td className="px-3 py-2 font-mono text-xs truncate max-w-[140px]">
                    {r.record_id?.slice(0, 8)}…
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setViewing(r)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground self-center">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Change details</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-2 text-sm">
              <div className="text-xs text-muted-foreground">
                {viewing.action} on <span className="font-mono">{viewing.table_name}</span> ·{' '}
                {new Date(viewing.created_at).toLocaleString()} · {viewing.actor_email ?? 'unknown'}
              </div>
              <pre className="bg-secondary rounded p-3 text-xs overflow-auto max-h-[60vh]">
                {JSON.stringify(viewing.changes, null, 2)}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditLog;
