// Per-work-type checklist items used in TicketWork "Working" step.
export const WORK_CHECKLISTS: Record<string, string[]> = {
  'make-ready': ['Paint', 'Clean', 'Repairs', 'Appliance check', 'Final walkthrough'],
  'make_ready': ['Paint', 'Clean', 'Repairs', 'Appliance check', 'Final walkthrough'],
  'repair':     ['Diagnose', 'Parts needed', 'Fix', 'Test', 'Photo'],
  'emergency':  ['Contain issue', 'Fix', 'Verify', 'Photo'],
  'capex':      ['Site assessment', 'Work execution', 'Quality check', 'Final documentation'],
};

export function getChecklistFor(workType?: string | null): string[] {
  if (!workType) return [];
  return WORK_CHECKLISTS[workType] ?? [];
}
