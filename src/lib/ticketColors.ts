const makeReadyColors = {
  bg: 'bg-primary/10',
  border: 'border-primary/40',
  badge: 'bg-primary text-primary-foreground',
};

export const workTypeColors: Record<string, { bg: string; border: string; badge: string }> = {
  'make-ready': makeReadyColors,
  'make_ready': makeReadyColors,
  emergency: {
    bg: 'bg-destructive/10',
    border: 'border-destructive/40',
    badge: 'bg-destructive text-destructive-foreground',
  },
  repair: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/40',
    badge: 'bg-blue-500 text-white',
  },
  capex: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/40',
    badge: 'bg-green-500 text-white',
  },
};

export const getTicketColor = (workType: string | null): string => {
  switch (workType) {
    case 'make_ready': case 'make-ready': return 'hsl(45, 100%, 51%)';
    case 'emergency': return 'hsl(0, 72%, 59%)';
    case 'repair': return 'hsl(217, 91%, 60%)';
    case 'capex': return 'hsl(142, 71%, 45%)';
    default: return 'hsl(0, 0%, 40%)';
  }
};

export const statusLabels: Record<string, string> = {
  draft: 'Draft',
  open: 'Open',
  in_progress: 'In Progress',
  paused: 'Paused',
  pending_evaluation: 'Pending Evaluation',
  pending_estimate: 'Pending Estimate',
  estimate_sent: 'Estimate Sent',
  estimate_approved: 'Estimate Approved',
  ready_for_review: 'Ready for Review',
  closed: 'Closed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  open: 'bg-primary/20 text-primary',
  in_progress: 'bg-blue-500/20 text-blue-400',
  paused: 'bg-orange-500/20 text-orange-400',
  pending_evaluation: 'bg-yellow-500/20 text-yellow-500',
  pending_estimate: 'bg-amber-500/20 text-amber-500',
  estimate_sent: 'bg-indigo-500/20 text-indigo-400',
  estimate_approved: 'bg-emerald-500/20 text-emerald-400',
  ready_for_review: 'bg-purple-500/20 text-purple-400',
  closed: 'bg-green-500/20 text-green-400',
  rejected: 'bg-destructive/20 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};
