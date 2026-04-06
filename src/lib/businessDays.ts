import { supabase } from '@/integrations/supabase/client';

// Calculate business days elapsed since a start date, excluding weekends and holidays
export async function getBusinessDaysElapsed(
  startDate: Date,
  pausedDays: number = 0
): Promise<number> {
  const now = new Date();
  
  // Fetch holidays
  const { data: holidays } = await supabase
    .from('holidays')
    .select('date')
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', now.toISOString().split('T')[0]);

  const holidaySet = new Set(holidays?.map(h => h.date) ?? []);

  let businessDays = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  while (current <= now) {
    const day = current.getDay();
    const dateStr = current.toISOString().split('T')[0];
    if (day !== 0 && day !== 6 && !holidaySet.has(dateStr)) {
      businessDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  return Math.max(0, businessDays - pausedDays);
}

export function getCountdownDaysRemaining(
  businessDaysElapsed: number,
  totalDays: number = 5
): number {
  return Math.max(0, totalDays - businessDaysElapsed);
}

export function getCountdownColor(remaining: number): string {
  if (remaining <= 1) return 'text-destructive';
  if (remaining <= 2) return 'text-orange-400';
  return 'text-primary';
}
