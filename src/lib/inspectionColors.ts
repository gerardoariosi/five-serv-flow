export const inspectionStatusLabels: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  pending_pricing: 'Pending Pricing',
  sent: 'Sent to PM',
  pm_responded: 'PM Responded',
  estimate_approved: 'Estimate Approved',
  converted: 'Converted',
  closed_internally: 'Closed Internally',
  complete: 'Complete',
};

export const inspectionStatusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-[hsl(217,91%,55%)]/15 text-[hsl(217,91%,45%)]',
  in_progress: 'bg-[hsl(217,91%,55%)]/15 text-[hsl(217,91%,45%)]',
  pending_pricing: 'bg-[hsl(27,96%,50%)]/15 text-[hsl(27,96%,40%)]',
  sent: 'bg-primary/20 text-primary',
  pm_responded: 'bg-[hsl(270,60%,55%)]/15 text-[hsl(270,60%,45%)]',
  estimate_approved: 'bg-[hsl(142,71%,40%)]/15 text-[hsl(142,71%,30%)]',
  converted: 'bg-[hsl(142,71%,40%)]/15 text-[hsl(142,71%,30%)]',
  closed_internally: 'bg-muted text-muted-foreground',
  complete: 'bg-[hsl(142,71%,40%)]/15 text-[hsl(142,71%,30%)]',
};
