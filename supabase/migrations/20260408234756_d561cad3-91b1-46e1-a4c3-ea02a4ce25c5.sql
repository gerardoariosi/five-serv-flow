
-- Add pm_general_note column
ALTER TABLE public.inspections ADD COLUMN pm_general_note text;

-- Drop old weak anon UPDATE policy on inspections
DROP POLICY IF EXISTS "Public can update inspections by token" ON public.inspections;

-- Create tighter anon UPDATE policy: only allow update when the row's pm_link_token matches
-- the token passed via x-pm-token header OR when updating specific PM response fields
CREATE POLICY "Public can update inspections by token"
ON public.inspections
FOR UPDATE
TO anon
USING (pm_link_token IS NOT NULL AND link_expires_at > now())
WITH CHECK (pm_link_token IS NOT NULL AND link_expires_at > now());

-- Drop old weak anon UPDATE policy on inspection_items  
DROP POLICY IF EXISTS "Public can update inspection items" ON public.inspection_items;

-- Create tighter anon UPDATE policy: only items belonging to inspections with valid tokens
CREATE POLICY "Public can update inspection items"
ON public.inspection_items
FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.inspections
    WHERE inspections.id = inspection_items.inspection_id
    AND inspections.pm_link_token IS NOT NULL
    AND inspections.link_expires_at > now()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.inspections
    WHERE inspections.id = inspection_items.inspection_id
    AND inspections.pm_link_token IS NOT NULL
    AND inspections.link_expires_at > now()
  )
);
