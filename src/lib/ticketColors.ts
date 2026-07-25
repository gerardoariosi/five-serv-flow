const makeReadyColors = {
  bg: 'bg-primary/10',
  border: 'border-primary/40',
  badge: 'bg-primary text-primary-foreground',
};

export const workTypeColors: Record<string, { bg: string; border: string; badge: string }> = {
  'make-ready': makeReadyColors,
  'make_ready': makeReadyColors,
  emergency: {
    bg: 'bg-danger-soft',
    border: 'border-danger/40',
    badge: 'bg-danger text-danger-foreground',
  },
  repair: {
    bg: 'bg-info-soft',
    border: 'border-info/40',
    badge: 'bg-info text-info-foreground',
  },
  capex: {
    bg: 'bg-success-soft',
    border: 'border-success/40',
    badge: 'bg-success text-success-foreground',
  },
};

export const getTicketColor = (workType: string | null): string => {
  switch (workType) {
    case 'make_ready': case 'make-ready': return 'hsl(var(--make-ready))';
    case 'emergency': return 'hsl(var(--emergency))';
    case 'repair': return 'hsl(var(--repair))';
    case 'capex': return 'hsl(var(--capex))';
    default: return 'hsl(var(--muted-foreground))';
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
  open: 'bg-primary/15 text-[hsl(45,100%,32%)]',
  in_progress: 'bg-info-soft text-info',
  paused: 'bg-warning-soft text-warning',
  pending_evaluation: 'bg-primary/15 text-[hsl(45,100%,32%)]',
  pending_estimate: 'bg-warning-soft text-warning',
  estimate_sent: 'bg-purple-soft text-purple',
  estimate_approved: 'bg-success-soft text-success',
  ready_for_review: 'bg-purple-soft text-purple',
  closed: 'bg-success-soft text-success',
  rejected: 'bg-danger-soft text-danger',
  cancelled: 'bg-muted text-muted-foreground',
};
