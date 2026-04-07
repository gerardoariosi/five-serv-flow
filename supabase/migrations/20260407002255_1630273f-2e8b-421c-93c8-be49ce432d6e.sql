
-- Fix zones: allow supervisor to manage (currently only admin)
DROP POLICY IF EXISTS "Admins can manage zones" ON public.zones;
CREATE POLICY "Admins and supervisors can manage zones" ON public.zones
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

-- Fix technicians_vendors: allow supervisor to manage
DROP POLICY IF EXISTS "Admins can manage technicians_vendors" ON public.technicians_vendors;
CREATE POLICY "Admins and supervisors can manage technicians_vendors" ON public.technicians_vendors
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

-- Add DELETE policy for user_roles (admin only)
CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Technician can update their own assigned tickets
-- (already exists, but let's ensure ticket_photos UPDATE exists)
CREATE POLICY "Technicians can update own photos" ON public.ticket_photos
  FOR UPDATE TO authenticated
  USING (technician_id = auth.uid())
  WITH CHECK (technician_id = auth.uid());

-- Admin/supervisor can manage ticket photos
CREATE POLICY "Admins and supervisors can manage ticket photos" ON public.ticket_photos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

-- Admin/supervisor can delete chat messages (soft delete)
CREATE POLICY "Admins can manage chat messages" ON public.chat_messages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow PM portal anonymous access to inspections and items
CREATE POLICY "Public can view inspections by token" ON public.inspections
  FOR SELECT TO anon
  USING (pm_link_token IS NOT NULL);

CREATE POLICY "Public can update inspections by token" ON public.inspections
  FOR UPDATE TO anon
  USING (pm_link_token IS NOT NULL)
  WITH CHECK (pm_link_token IS NOT NULL);

CREATE POLICY "Public can view inspection items" ON public.inspection_items
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Public can update inspection items" ON public.inspection_items
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);
