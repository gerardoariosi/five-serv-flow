
DROP POLICY IF EXISTS "vendor_docs_select" ON storage.objects;
CREATE POLICY "vendor_docs_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'vendor-documents'
  AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role)));

DROP POLICY IF EXISTS "vendor_docs_insert" ON storage.objects;
CREATE POLICY "vendor_docs_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'vendor-documents'
  AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role)));

DROP POLICY IF EXISTS "vendor_docs_delete" ON storage.objects;
CREATE POLICY "vendor_docs_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'vendor-documents' AND public.has_role(auth.uid(),'admin'::app_role));
