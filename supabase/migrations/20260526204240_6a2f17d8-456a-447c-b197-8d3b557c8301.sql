
-- 1. Tighten anon SELECT on clients (require active estimate token)
DROP POLICY IF EXISTS "Public can view clients via estimate token" ON public.clients;
CREATE POLICY "Public can view clients via estimate token"
ON public.clients FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM public.tickets t
  WHERE t.client_id = clients.id
    AND t.estimate_link_token IS NOT NULL
    AND t.estimate_expires_at > now()
));

-- 2. Tighten anon SELECT on properties
DROP POLICY IF EXISTS "Public can view properties via estimate token" ON public.properties;
CREATE POLICY "Public can view properties via estimate token"
ON public.properties FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM public.tickets t
  WHERE t.property_id = properties.id
    AND t.estimate_link_token IS NOT NULL
    AND t.estimate_expires_at > now()
));

-- 3. Restrict anon SELECT on inspection_items to mirror photo policy
DROP POLICY IF EXISTS "Public can view inspection items" ON public.inspection_items;
CREATE POLICY "Public can view inspection items"
ON public.inspection_items FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM public.inspections i
  WHERE i.id = inspection_items.inspection_id
    AND i.pm_link_token IS NOT NULL
    AND i.link_expires_at > now()
));

-- 4. Add expiry check to anon SELECT on inspections
DROP POLICY IF EXISTS "Public can view inspections by token" ON public.inspections;
CREATE POLICY "Public can view inspections by token"
ON public.inspections FOR SELECT TO anon
USING (pm_link_token IS NOT NULL AND link_expires_at > now());

-- 5. Add expiry check to anon SELECT on tickets
DROP POLICY IF EXISTS "Public can view tickets by estimate token" ON public.tickets;
CREATE POLICY "Public can view tickets by estimate token"
ON public.tickets FOR SELECT TO anon
USING (estimate_link_token IS NOT NULL AND estimate_expires_at > now());

-- 6. Remove user-facing SELECT on 2FA codes
DROP POLICY IF EXISTS "Users can view own 2fa codes" ON public.two_factor_codes;

-- 7. Restrict profile-photos UPDATE to owner's folder (allows chat uploads, since they INSERT only)
DROP POLICY IF EXISTS "Authenticated users can update profile photos" ON storage.objects;
CREATE POLICY "Users can update their own profile photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 8. Revoke EXECUTE on internal/trigger functions from anon and authenticated
REVOKE EXECUTE ON FUNCTION public.notify_ticket_created() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_inspection_pm_submitted() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_technician_assigned() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_ready_for_review() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_ticket_status_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_estimate_approved() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_inspection_assigned() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_property_address() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_push_subscriptions_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_property_notes_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_ins_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_fs_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_directory() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_inspection_master_pin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
