import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, FileDown, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getTicketColor } from '@/lib/ticketColors';

const BILLING_STATUSES = ['all', 'pending', 'invoiced', 'paid'];

const billingBadgeVariant = (status: string) => {
  switch (status) {
    case 'paid': return 'default';
    case 'invoiced': return 'secondary';
    default: return 'outline';
  }
};

const AccountingList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [billingFilter, setBillingFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [emailDialog, setEmailDialog] = useState<string | null>(null);
  const [emailTo, setEmailTo] = useState('');

  const { data: tickets = [] } = useQuery({
    queryKey: ['accounting-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, clients(company_name, contact_name), properties(name, address), zones(name)')
        .neq('status', 'draft')
        .order('closed_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    let result = tickets;
    if (billingFilter !== 'all') result = result.filter((t: any) => t.billing_status === billingFilter);
    if (typeFilter !== 'all') result = result.filter((t: any) => t.work_type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t: any) =>
        t.fs_number?.toLowerCase().includes(q) ||
        (t.clients as any)?.company_name?.toLowerCase().includes(q) ||
        (t.properties as any)?.name?.toLowerCase().includes(q) ||
        (t.properties as any)?.address?.toLowerCase().includes(q) ||
        t.qb_invoice_number?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [tickets, billingFilter, typeFilter, search]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((t: any) => t.id)));
    }
  };

  const handleExportSelected = () => {
    if (selected.size === 0) { toast.error('Select at least one ticket'); return; }
    toast.info(`Exporting ${selected.size} ticket(s) as PDF...`);
    // PDF generation would go here
  };

  const handleSendEmail = () => {
    if (!emailTo.trim() || !emailTo.includes('@')) { toast.error('Enter a valid email'); return; }
    toast.success(`PDF sent to ${emailTo}`);
    setEmailDialog(null);
    setEmailTo('');
  };

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-foreground">Accounting</h1>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search FS#, PM, property, invoice..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={billingFilter} onValueChange={setBillingFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Billing Status" /></SelectTrigger>
          <SelectContent>
            {BILLING_STATUSES.map((s) => <SelectItem key={s} value={s}>{s === 'all' ? 'All Billing' : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Work Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="make_ready">Make Ready</SelectItem>
            <SelectItem value="emergency">Emergency</SelectItem>
            <SelectItem value="repair">Repair</SelectItem>
            <SelectItem value="capex">CapEx</SelectItem>
          </SelectContent>
        </Select>
        {selected.size > 0 && (
          <Button size="sm" variant="outline" onClick={handleExportSelected}>
            <FileDown className="w-4 h-4 mr-1" /> Export Selected ({selected.size})
          </Button>
        )}
      </div>

      {/* Select All */}
      <div className="flex items-center gap-2">
        <Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} />
        <span className="text-xs text-muted-foreground">Select all ({filtered.length})</span>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No tickets found</p>}
        {filtered.map((ticket: any) => {
          const color = getTicketColor(ticket.work_type);
          return (
            <div
              key={ticket.id}
              className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:border-primary/40 transition-colors"
              style={{ borderLeftColor: color, borderLeftWidth: 3 }}
            >
              <Checkbox
                checked={selected.has(ticket.id)}
                onCheckedChange={() => toggleSelect(ticket.id)}
                className="mt-1"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/accounting/${ticket.id}`)}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-foreground">{ticket.fs_number || '—'}</span>
                  <Badge variant="outline" className="text-[10px]">{ticket.work_type}</Badge>
                  <Badge variant={billingBadgeVariant(ticket.billing_status)} className="text-[10px]">
                    {ticket.billing_status || 'pending'}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{ticket.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {(ticket.clients as any)?.company_name} • {(ticket.properties as any)?.name || (ticket.properties as any)?.address}
                </p>
                {ticket.qb_invoice_number && (
                  <p className="text-[10px] text-muted-foreground">QB: {ticket.qb_invoice_number}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); toast.info('Exporting PDF...'); }}>
                  <FileDown className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEmailDialog(ticket.id); }}>
                  <Mail className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Email Dialog */}
      <Dialog open={!!emailDialog} onOpenChange={() => { setEmailDialog(null); setEmailTo(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send PDF by Email</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Recipient Email</Label>
              <Input placeholder="email@example.com" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEmailDialog(null); setEmailTo(''); }}>Cancel</Button>
            <Button onClick={handleSendEmail}>Send PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountingList;
