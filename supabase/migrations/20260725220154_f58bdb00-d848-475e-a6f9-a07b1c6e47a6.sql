-- Restrict ticket-photos and inspection-photos storage access to staff roles only
DROP POLICY IF EXISTS "Authenticated users can view ticket photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload ticket photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view inspection photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload inspection photos" ON storage.objects;

CREATE POLICY "Staff can view ticket photos" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'ticket-photos' AND public.has_any_staff_role(auth.uid()));

CREATE POLICY "Staff can upload ticket photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ticket-photos' AND public.has_any_staff_role(auth.uid()));

CREATE POLICY "Staff can view inspection photos" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'inspection-photos' AND public.has_any_staff_role(auth.uid()));

CREATE POLICY "Staff can upload inspection photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'inspection-photos' AND public.has_any_staff_role(auth.uid()));