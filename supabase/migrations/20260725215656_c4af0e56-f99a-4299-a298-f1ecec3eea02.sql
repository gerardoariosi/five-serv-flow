
-- Feature 1: Vendor Payments — add pending/paid columns + backfill
ALTER TABLE public.vendor_payments
  ADD COLUMN IF NOT EXISTS week_ending_date date,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS paid_at date;

-- Backfill existing rows as paid
UPDATE public.vendor_payments
SET status = COALESCE(status, 'paid'),
    paid_at = COALESCE(paid_at, payment_date),
    week_ending_date = COALESCE(week_ending_date, payment_date),
    due_date = COALESCE(due_date, payment_date)
WHERE status IS NULL OR status NOT IN ('pending','paid');

ALTER TABLE public.vendor_payments
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.vendor_payments
  DROP CONSTRAINT IF EXISTS vendor_payments_status_check;
ALTER TABLE public.vendor_payments
  ADD CONSTRAINT vendor_payments_status_check CHECK (status IN ('pending','paid'));

CREATE INDEX IF NOT EXISTS vendor_payments_status_due_idx
  ON public.vendor_payments(status, due_date);
CREATE INDEX IF NOT EXISTS vendor_payments_vendor_status_idx
  ON public.vendor_payments(vendor_id, status);

-- Feature 3: property_documents table
CREATE TABLE IF NOT EXISTS public.property_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('gallery','estimate_invoice')),
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  note text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_documents TO authenticated;
GRANT ALL ON public.property_documents TO service_role;

ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view property documents"
  ON public.property_documents FOR SELECT TO authenticated
  USING (public.has_any_staff_role(auth.uid()));

CREATE POLICY "Staff can insert property documents"
  ON public.property_documents FOR INSERT TO authenticated
  WITH CHECK (public.has_any_staff_role(auth.uid()));

CREATE POLICY "Staff can update property documents"
  ON public.property_documents FOR UPDATE TO authenticated
  USING (public.has_any_staff_role(auth.uid()))
  WITH CHECK (public.has_any_staff_role(auth.uid()));

CREATE POLICY "Staff can delete property documents"
  ON public.property_documents FOR DELETE TO authenticated
  USING (public.has_any_staff_role(auth.uid()));

CREATE INDEX IF NOT EXISTS property_documents_property_kind_idx
  ON public.property_documents(property_id, kind, created_at DESC);

-- Storage RLS for the new bucket (bucket is created via the storage tool)
CREATE POLICY "Staff can read property-documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'property-documents' AND public.has_any_staff_role(auth.uid()));

CREATE POLICY "Staff can upload property-documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'property-documents' AND public.has_any_staff_role(auth.uid()));

CREATE POLICY "Staff can update property-documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'property-documents' AND public.has_any_staff_role(auth.uid()))
  WITH CHECK (bucket_id = 'property-documents' AND public.has_any_staff_role(auth.uid()));

CREATE POLICY "Staff can delete property-documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'property-documents' AND public.has_any_staff_role(auth.uid()));
