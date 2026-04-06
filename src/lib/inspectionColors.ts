export const inspectionStatusLabels: Record<string, string> = {
  draft: 'Draft',
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
  in_progress: 'bg-blue-500/20 text-blue-400',
  pending_pricing: 'bg-orange-500/20 text-orange-400',
  sent: 'bg-primary/20 text-primary',
  pm_responded: 'bg-purple-500/20 text-purple-400',
  estimate_approved: 'bg-green-500/20 text-green-400',
  converted: 'bg-green-500/20 text-green-400',
  closed_internally: 'bg-muted text-muted-foreground',
  complete: 'bg-green-500/20 text-green-400',
};
