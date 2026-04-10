
-- 1. Add dedicated technician note column to inspection_items
ALTER TABLE public.inspection_items ADD COLUMN IF NOT EXISTS note text;

-- 2. Allow anon SELECT on inspection_photos for valid portal links
CREATE POLICY "anon_select_inspection_photos_via_token"
ON public.inspection_photos
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.inspections i
    WHERE i.id = inspection_photos.inspection_id
      AND i.pm_link_token IS NOT NULL
      AND i.link_expires_at > now()
  )
);
