import { useNavigate } from 'react-router-dom';
import { BarChart3, Clock, AlertTriangle, Users, MapPin, TrendingUp, PauseCircle, CalendarDays, CheckCircle, Activity } from 'lucide-react';

const reports = [
  { slug: 'operational-summary', title: 'Operational Summary', description: 'Overview of all tickets, statuses, and key metrics across the organization.', icon: BarChart3 },
  { slug: 'make-ready-compliance', title: 'Make-Ready Compliance', description: '5-day turnaround compliance rate with traffic light scoring.', icon: CheckCircle },
  { slug: 'tickets-by-technician', title: 'Tickets by Technician', description: 'Ticket volume and types assigned per technician.', icon: Users },
  { slug: 'on-time-vs-late', title: 'On Time vs Late', description: 'Track appointments completed on schedule versus delayed.', icon: Clock },
  { slug: 'rejections-by-technician', title: 'Rejections by Technician', description: 'Review rejection frequency and patterns per technician.', icon: AlertTriangle },
  { slug: 'tickets-by-pm', title: 'Tickets by PM', description: 'Ticket distribution across property managers.', icon: MapPin },
  { slug: 'tickets-by-zone', title: 'Tickets by Zone', description: 'Geographic distribution of work orders by zone.', icon: MapPin },
  { slug: 'average-closing-time', title: 'Average Closing Time', description: 'Mean time from ticket creation to closure by type.', icon: TrendingUp },
  { slug: 'paused-pending', title: 'Paused & Pending', description: 'Tickets currently paused or awaiting action.', icon: PauseCircle },
  { slug: 'activity-by-period', title: 'Activity by Period', description: 'Ticket creation and completion trends over time.', icon: Activity },
];

const ReportList = () => {
  const navigate = useNavigate();

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-foreground">Reports</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {reports.map((r) => (
          <div
            key={r.slug}
            onClick={() => navigate(`/reports/${r.slug}`)}
            className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card cursor-pointer hover:border-primary/40 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
              <r.icon className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary">{r.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportList;
