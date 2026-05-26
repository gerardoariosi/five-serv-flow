
REVOKE EXECUTE ON FUNCTION public.notify_ticket_created() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_inspection_pm_submitted() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_technician_assigned() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_ready_for_review() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_ticket_status_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_estimate_approved() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_inspection_assigned() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_property_address() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_push_subscriptions_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_property_notes_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_ins_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_fs_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_directory() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_inspection_master_pin(uuid) FROM PUBLIC, anon;

-- Keep has_role callable since it's used inside RLS policies; ensure it stays granted to authenticated only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Re-grant the ones authenticated app code legitimately calls
GRANT EXECUTE ON FUNCTION public.generate_ins_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_fs_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_directory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_inspection_master_pin(uuid) TO authenticated;
