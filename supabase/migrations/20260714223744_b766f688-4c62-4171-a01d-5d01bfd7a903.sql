
-- 1) Revoke EXECUTE on SECURITY DEFINER email-queue helpers from authenticated/anon/public
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_wake() TO service_role;

-- 2) Accounting ticket update column restriction via trigger
CREATE OR REPLACE FUNCTION public.enforce_accounting_ticket_column_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins and supervisors are unrestricted
  IF auth.uid() IS NULL
     OR has_role(auth.uid(), 'admin'::app_role)
     OR has_role(auth.uid(), 'supervisor'::app_role) THEN
    RETURN NEW;
  END IF;

  -- If updater has accounting role, only billing columns may change
  IF has_role(auth.uid(), 'accounting'::app_role) THEN
    IF NEW.billing_status IS DISTINCT FROM OLD.billing_status
       OR NEW.qb_invoice_number IS DISTINCT FROM OLD.qb_invoice_number
       OR NEW.accounting_notes IS DISTINCT FROM OLD.accounting_notes THEN
      -- allowed; now ensure nothing else changed
      IF to_jsonb(NEW) - 'billing_status' - 'qb_invoice_number' - 'accounting_notes'
         IS DISTINCT FROM
         to_jsonb(OLD) - 'billing_status' - 'qb_invoice_number' - 'accounting_notes' THEN
        RAISE EXCEPTION 'Accounting role can only update billing_status, qb_invoice_number, accounting_notes';
      END IF;
    ELSE
      -- No billing change at all — reject to avoid unintended writes
      IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
        RAISE EXCEPTION 'Accounting role can only update billing_status, qb_invoice_number, accounting_notes';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_accounting_ticket_column_scope ON public.tickets;
CREATE TRIGGER trg_enforce_accounting_ticket_column_scope
BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.enforce_accounting_ticket_column_scope();

-- 3) inspection-photos: owner-scoped DELETE + UPDATE storage policies
CREATE POLICY "Users can delete their own inspection photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'inspection-photos' AND owner = auth.uid());

CREATE POLICY "Users can update their own inspection photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'inspection-photos' AND owner = auth.uid())
WITH CHECK (bucket_id = 'inspection-photos' AND owner = auth.uid());

-- 4) profile-photos: tighten INSERT policy to require folder ownership
DROP POLICY IF EXISTS "Authenticated users can upload profile photos" ON storage.objects;
CREATE POLICY "Users can upload their own profile photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5) two_factor_codes: restrict to service_role only
DROP POLICY IF EXISTS "Service role manages 2fa codes" ON public.two_factor_codes;
CREATE POLICY "Service role manages 2fa codes"
ON public.two_factor_codes FOR ALL
TO service_role
USING (true) WITH CHECK (true);
