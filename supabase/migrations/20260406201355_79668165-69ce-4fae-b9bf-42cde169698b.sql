-- Fix 1: Enforce changed_by = auth.uid() on ticket_timeline INSERT
DROP POLICY IF EXISTS "Authenticated users can add timeline entries" ON ticket_timeline;
CREATE POLICY "Users can only log timeline as themselves"
  ON ticket_timeline FOR INSERT
  TO authenticated
  WITH CHECK (changed_by = auth.uid());

-- Fix 2: Create a view that masks master_pin_used for non-admins
CREATE OR REPLACE FUNCTION public.get_inspection_master_pin(inspection_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)
    THEN master_pin_used
    ELSE NULL
  END
  FROM inspections
  WHERE id = inspection_id;
$$;