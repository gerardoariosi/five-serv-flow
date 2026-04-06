import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileDown, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays, differenceInHours } from 'date-fns';

const REPORT_TITLES: Record<string, string> = {
  'operational-summary': 'Operational Summary',
  'make-ready-compliance': 'Make-Ready Compliance',
  'tickets-by-technician': 'Tickets by Technician',
  'on-time-vs-late': 'On Time vs Late',
  'rejections-by-technician': 'Rejections by Technician',
  'tickets-by-pm': 'Tickets by PM',
  'tickets-by-zone': 'Tickets by Zone',
  'average-closing-time': 'Average Closing Time',
  'paused-pending': 'Paused & Pending',
  'activity-by-period': 'Activity by Period',
};

const ReportDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const title = REPORT_TITLES[slug || ''] || 'Report';

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pmFilter, setPmFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [techFilter, setTechFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [applied, setApplied] = useState(false);

  const { data: tickets = [] } = useQuery({
    queryKey: ['report-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, clients(company_name), properties(name, address), zones(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['report-clients'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, company_name').eq('status', 'active');
      return data || [];
    },
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['report-zones'],
    queryFn: async () => {
      const { data } = await supabase.from('zones').select('id, name').eq('status', 'active');
      return data || [];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ['report-users'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_user_directory');
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    let result = tickets;
    if (dateFrom) result = result.filter((t: any) => t.created_at >= dateFrom);
    if (dateTo) result = result.filter((t: any) => t.created_at <= dateTo + 'T23:59:59');
    if (pmFilter !== 'all') result = result.filter((t: any) => t.client_id === pmFilter);
    if (zoneFilter !== 'all') result = result.filter((t: any) => t.zone_id === zoneFilter);
    if (techFilter !== 'all') result = result.filter((t: any) => t.technician_id === techFilter);
    if (typeFilter !== 'all') result = result.filter((t: any) => t.work_type === typeFilter);
    return result;
  }, [tickets, dateFrom, dateTo, pmFilter, zoneFilter, techFilter, typeFilter]);

  const userMap = useMemo(() => {
    const m: Record<string, string> = {};
    users.forEach((u: any) => { m[u.id] = u.full_name || 'Unknown'; });
    return m;
  }, [users]);

  const resetFilters = () => {
    setDateFrom(''); setDateTo(''); setPmFilter('all'); setZoneFilter('all'); setTechFilter('all'); setTypeFilter('all');
  };

  // Compute report-specific KPIs
  const kpis = useMemo(() => {
    const total = filtered.length;
    const closed = filtered.filter((t: any) => t.status === 'closed');
    const open = filtered.filter((t: any) => t.status === 'open');
    const inProgress = filtered.filter((t: any) => t.status === 'in_progress');
    const paused = filtered.filter((t: any) => t.status === 'paused');
    const makeReady = filtered.filter((t: any) => t.work_type === 'make_ready' || t.work_type === 'make-ready');
    const makeReadyClosed = makeReady.filter((t: any) => t.status === 'closed' && t.work_started_at && t.closed_at);

    switch (slug) {
      case 'operational-summary':
        return [
          { label: 'Total Tickets', value: total },
          { label: 'Open', value: open.length },
          { label: 'In Progress', value: inProgress.length },
          { label: 'Closed', value: closed.length },
        ];
      case 'make-ready-compliance': {
        const onTime = makeReadyClosed.filter((t: any) => {
          const days = differenceInDays(new Date(t.closed_at), new Date(t.work_started_at));
          return days <= 5;
        });
        const rate = makeReadyClosed.length > 0 ? Math.round((onTime.length / makeReadyClosed.length) * 100) : 0;
        return [
          { label: 'Compliance Rate', value: `${rate}%`, highlight: rate >= 80 ? 'green' : rate >= 60 ? 'yellow' : 'red' },
          { label: 'Total Make-Ready', value: makeReady.length },
          { label: 'On Time', value: onTime.length },
          { label: 'Late', value: makeReadyClosed.length - onTime.length },
        ];
      }
      case 'average-closing-time': {
        const withTimes = closed.filter((t: any) => t.created_at && t.closed_at);
        const avgHours = withTimes.length > 0
          ? Math.round(withTimes.reduce((sum: number, t: any) => sum + differenceInHours(new Date(t.closed_at), new Date(t.created_at)), 0) / withTimes.length)
          : 0;
        return [
          { label: 'Avg Hours to Close', value: avgHours },
          { label: 'Avg Days', value: Math.round(avgHours / 24) },
          { label: 'Closed Tickets', value: withTimes.length },
        ];
      }
      case 'paused-pending':
        return [
          { label: 'Paused', value: paused.length },
          { label: 'Pending Review', value: filtered.filter((t: any) => t.status === 'ready_for_review').length },
          { label: 'Unassigned', value: filtered.filter((t: any) => !t.technician_id && t.status !== 'draft' && t.status !== 'cancelled').length },
        ];
      default:
        return [
          { label: 'Total', value: total },
          { label: 'Closed', value: closed.length },
          { label: 'Open', value: open.length },
        ];
    }
  }, [filtered, slug]);

  // Generate data table rows based on report type
  const tableData = useMemo(() => {
    switch (slug) {
      case 'tickets-by-technician': {
        const byTech: Record<string, number> = {};
        filtered.forEach((t: any) => {
          const name = t.technician_id ? (userMap[t.technician_id] || 'Unknown') : 'Unassigned';
          byTech[name] = (byTech[name] || 0) + 1;
        });
        return { headers: ['Technician', 'Tickets'], rows: Object.entries(byTech).sort((a, b) => b[1] - a[1]).map(([name, count]) => [name, count.toString()]) };
      }
      case 'rejections-by-technician': {
        const byTech: Record<string, number> = {};
        filtered.filter((t: any) => (t.rejection_count || 0) > 0).forEach((t: any) => {
          const name = t.technician_id ? (userMap[t.technician_id] || 'Unknown') : 'Unassigned';
          byTech[name] = (byTech[name] || 0) + (t.rejection_count || 0);
        });
        return { headers: ['Technician', 'Rejections'], rows: Object.entries(byTech).sort((a, b) => b[1] - a[1]).map(([name, count]) => [name, count.toString()]) };
      }
      case 'tickets-by-pm': {
        const byPm: Record<string, number> = {};
        filtered.forEach((t: any) => {
          const name = (t.clients as any)?.company_name || 'Unknown';
          byPm[name] = (byPm[name] || 0) + 1;
        });
        return { headers: ['Property Manager', 'Tickets'], rows: Object.entries(byPm).sort((a, b) => b[1] - a[1]).map(([name, count]) => [name, count.toString()]) };
      }
      case 'tickets-by-zone': {
        const byZone: Record<string, number> = {};
        filtered.forEach((t: any) => {
          const name = (t.zones as any)?.name || 'No Zone';
          byZone[name] = (byZone[name] || 0) + 1;
        });
        return { headers: ['Zone', 'Tickets'], rows: Object.entries(byZone).sort((a, b) => b[1] - a[1]).map(([name, count]) => [name, count.toString()]) };
      }
      default: {
        return {
          headers: ['FS #', 'Type', 'Status', 'Property', 'Created'],
          rows: filtered.slice(0, 100).map((t: any) => [
            t.fs_number || '—',
            t.work_type || '—',
            t.status || '—',
            (t.properties as any)?.name || (t.properties as any)?.address || '—',
            t.created_at ? format(new Date(t.created_at), 'MMM d, yyyy') : '—',
          ]),
        };
      }
    }
  }, [filtered, slug, userMap]);

  const complianceHighlight = kpis.find((k: any) => k.highlight);

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/reports')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">PM</Label>
            <Select value={pmFilter} onValueChange={setPmFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All PMs</SelectItem>
                {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Zone</Label>
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map((z: any) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Technician</Label>
            <Select value={techFilter} onValueChange={setTechFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Technicians</SelectItem>
                {users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Work Type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="make_ready">Make Ready</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
                <SelectItem value="repair">Repair</SelectItem>
                <SelectItem value="capex">CapEx</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setApplied(true)}>Apply</Button>
          <Button size="sm" variant="outline" onClick={resetFilters}><RotateCcw className="w-3 h-3 mr-1" /> Reset</Button>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => toast.info('Exporting PDF...')}>
            <FileDown className="w-3 h-3 mr-1" /> Export PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((kpi: any, i: number) => (
          <div
            key={i}
            className={`rounded-lg border p-4 text-center ${
              kpi.highlight === 'green' ? 'border-green-500 bg-green-500/10' :
              kpi.highlight === 'yellow' ? 'border-yellow-500 bg-yellow-500/10' :
              kpi.highlight === 'red' ? 'border-red-500 bg-red-500/10' :
              'border-primary/30 bg-primary/5'
            }`}
          >
            <p className={`text-2xl font-bold ${
              kpi.highlight === 'green' ? 'text-green-400' :
              kpi.highlight === 'yellow' ? 'text-yellow-400' :
              kpi.highlight === 'red' ? 'text-red-400' :
              'text-primary'
            }`}>{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Data Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                {tableData.headers.map((h, i) => (
                  <th key={i} className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.rows.length === 0 && (
                <tr><td colSpan={tableData.headers.length} className="text-center py-8 text-muted-foreground text-sm">No data</td></tr>
              )}
              {tableData.rows.map((row, i) => (
                <tr key={i} className="border-t border-border hover:bg-secondary/50">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 text-foreground">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportDetail;
