import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, DollarSign, AlertTriangle } from 'lucide-react';
import AddVendorPaymentDialog from '@/components/vendors/AddVendorPaymentDialog';

interface VendorRow {
  id: string;
  company_name: string;
  balance: number;
  oldest_due: string;
}

const VendorPayablesTab = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ['vendor-payables'],
    queryFn: async (): Promise<VendorRow[]> => {
      const { data, error } = await supabase
        .from('vendor_payments')
        .select('vendor_id, amount, due_date, technicians_vendors!inner(id, company_name)')
        .eq('status', 'pending');
      if (error) throw error;
      const agg = new Map<string, VendorRow>();
      for (const r of (data ?? []) as any[]) {
        const v = r.technicians_vendors;
        if (!v?.id) continue;
        const existing = agg.get(v.id);
        const amt = Number(r.amount ?? 0);
        const due = r.due_date as string | null;
        if (!existing) {
          agg.set(v.id, { id: v.id, company_name: v.company_name, balance: amt, oldest_due: due ?? '' });
        } else {
          existing.balance += amt;
          if (due && (!existing.oldest_due || due < existing.oldest_due)) existing.oldest_due = due;
        }
      }
      return Array.from(agg.values()).sort((a, b) => (a.oldest_due || '9999').localeCompare(b.oldest_due || '9999'));
    },
  });

  const totalOwed = useMemo(() => rows.reduce((s, r) => s + r.balance, 0), [rows]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <DollarSign className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total owed to vendors</p>
            <p className="text-xl font-bold text-foreground tabular-nums">${totalOwed.toFixed(2)}</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Payment
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No pending vendor payments.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => {
            const overdue = r.oldest_due && r.oldest_due < today;
            return (
              <button
                key={r.id}
                onClick={() => navigate(`/team/vendors/${r.id}`)}
                className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:border-primary/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{r.company_name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    {overdue && <AlertTriangle className="w-3 h-3 text-destructive" />}
                    Oldest due: {r.oldest_due || '—'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground tabular-nums">${r.balance.toFixed(2)}</p>
                  {overdue && <Badge variant="destructive" className="text-[10px] mt-1">Overdue</Badge>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <AddVendorPaymentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={() => qc.invalidateQueries({ queryKey: ['vendor-payables'] })}
      />
    </div>
  );
};

export default VendorPayablesTab;
