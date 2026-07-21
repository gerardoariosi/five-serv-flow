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
    bg: 'bg-[hsl(217,91%,55%)]/10',
    border: 'border-[hsl(217,91%,55%)]/40',
    badge: 'bg-[hsl(217,91%,45%)] text-white',
  },
  capex: {
    bg: 'bg-[hsl(142,71%,40%)]/10',
    border: 'border-[hsl(142,71%,40%)]/40',
    badge: 'bg-[hsl(142,71%,35%)] text-white',
  },
};

export const getTicketColor = (workType: string | null): string => {
  switch (workType) {
    case 'make_ready': case 'make-ready': return 'hsl(45, 100%, 51%)';
    case 'emergency': return 'hsl(0, 72%, 59%)';
    case 'repair': return 'hsl(217, 91%, 55%)';
    case 'capex': return 'hsl(142, 71%, 40%)';
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
  in_progress: 'bg-[hsl(217,91%,55%)]/15 text-[hsl(217,91%,45%)]',
  paused: 'bg-[hsl(27,96%,50%)]/15 text-[hsl(27,96%,40%)]',
  pending_evaluation: 'bg-[hsl(45,100%,50%)]/15 text-[hsl(45,100%,35%)]',
  pending_estimate: 'bg-[hsl(38,92%,50%)]/15 text-[hsl(38,92%,35%)]',
  estimate_sent: 'bg-[hsl(239,84%,67%)]/15 text-[hsl(239,84%,55%)]',
  estimate_approved: 'bg-[hsl(160,84%,39%)]/15 text-[hsl(160,84%,30%)]',
  ready_for_review: 'bg-[hsl(270,60%,55%)]/15 text-[hsl(270,60%,45%)]',
  closed: 'bg-[hsl(142,71%,40%)]/15 text-[hsl(142,71%,30%)]',
  rejected: 'bg-destructive/15 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};
