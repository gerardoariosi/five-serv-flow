
-- Fix 1: Restrict users table SELECT to own row + admin
DROP POLICY IF EXISTS "Authenticated users can view users" ON users;
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Admins can view all users"
  ON users FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create a safe view for name lookups (no sensitive fields)
CREATE OR REPLACE VIEW public.user_directory AS
  SELECT id, full_name FROM public.users;

-- Grant access to the view
GRANT SELECT ON public.user_directory TO authenticated;

-- Fix 2: Restrict user_roles SELECT to own row + admin
DROP POLICY IF EXISTS "Authenticated users can view roles" ON user_roles;
CREATE POLICY "Users can view own roles"
  ON user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles"
  ON user_roles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 3: Restrict tickets UPDATE by role
DROP POLICY IF EXISTS "Authenticated users can update tickets" ON tickets;
CREATE POLICY "Admins and supervisors can update any ticket"
  ON tickets FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Accounting can update billing fields"
  ON tickets FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'accounting'::app_role));
CREATE POLICY "Technicians can update assigned tickets"
  ON tickets FOR UPDATE TO authenticated
  USING (technician_id = auth.uid());

-- Fix 4: Restrict ticket_photos INSERT to own uploads
DROP POLICY IF EXISTS "Authenticated users can upload ticket photos" ON ticket_photos;
CREATE POLICY "Users upload photos as themselves"
  ON ticket_photos FOR INSERT TO authenticated
  WITH CHECK (technician_id = auth.uid());

-- Fix 5: Restrict inspection_items and inspection_tickets management to admin/supervisor
DROP POLICY IF EXISTS "Authenticated users can manage inspection items" ON inspection_items;
CREATE POLICY "Admins and supervisors can manage inspection items"
  ON inspection_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

DROP POLICY IF EXISTS "Authenticated users can manage inspection tickets" ON inspection_tickets;
CREATE POLICY "Admins and supervisors can manage inspection tickets"
  ON inspection_tickets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

-- Fix 6: Restrict tickets INSERT to admin/supervisor
DROP POLICY IF EXISTS "Authenticated users can create tickets" ON tickets;
CREATE POLICY "Admins and supervisors can create tickets"
  ON tickets FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));
