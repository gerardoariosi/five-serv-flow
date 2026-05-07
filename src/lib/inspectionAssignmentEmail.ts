import { supabase } from '@/integrations/supabase/client';

interface SendArgs {
  inspectionId: string;
  insNumber: string | null;
  assignedTo: string;
  visitDate: string | null;
  visitTime?: string | null;
  propertyAddress?: string | null;
}

/**
 * Sends the inspection-assigned transactional email to the assignee.
 * Looks up the user's email + name; silently no-ops if missing.
 */
export async function sendInspectionAssignedEmail({
  inspectionId,
  insNumber,
  assignedTo,
  visitDate,
  visitTime,
  propertyAddress,
}: SendArgs): Promise<void> {
  try {
    const { data: u } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', assignedTo)
      .maybeSingle();

    if (!u?.email) return;

    const detailUrl = `${window.location.origin}/inspections/${inspectionId}`;
    await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'inspection-assigned',
        recipientEmail: u.email,
        idempotencyKey: `inspection-assigned-${inspectionId}-${assignedTo}-${visitDate ?? 'tbd'}`,
        templateData: {
          ins_number: insNumber ?? '',
          property_address: propertyAddress ?? '',
          visit_date: visitDate ?? 'TBD',
          visit_time: visitTime ?? '',
          assignee_name: u.full_name ?? '',
          detail_url: detailUrl,
        },
      },
    });
  } catch (e) {
    console.error('Failed to send inspection assignment email', e);
  }
}
