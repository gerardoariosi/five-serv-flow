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
  scheduled: 'bg-info-soft text-info',
  in_progress: 'bg-info-soft text-info',
  pending_pricing: 'bg-warning-soft text-warning',
  sent: 'bg-primary/15 text-[hsl(45,100%,32%)]',
  pm_responded: 'bg-purple-soft text-purple',
  estimate_approved: 'bg-success-soft text-success',
  converted: 'bg-success-soft text-success',
  closed_internally: 'bg-muted text-muted-foreground',
  complete: 'bg-success-soft text-success',
};
