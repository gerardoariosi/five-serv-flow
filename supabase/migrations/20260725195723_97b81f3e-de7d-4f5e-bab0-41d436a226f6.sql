
-- Helper: does the caller have any staff role?
CREATE OR REPLACE FUNCTION public.has_any_staff_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','supervisor','technician','accounting')
  )
$$;
GRANT EXECUTE ON FUNCTION public.has_any_staff_role(uuid) TO authenticated;

-- Helper: does the caller's role appear in the group's role_access array?
CREATE OR REPLACE FUNCTION public.user_in_group_role_access(_user_id uuid, _role_access text[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR _role_access IS NULL
    OR COALESCE(array_length(_role_access, 1), 0) = 0
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role::text = ANY(_role_access)
    )
$$;
GRANT EXECUTE ON FUNCTION public.user_in_group_role_access(uuid, text[]) TO authenticated;

-- ============ CHAT ============
DROP POLICY IF EXISTS "Authenticated users can view chat groups" ON public.chat_groups;
CREATE POLICY "Staff can view chat groups scoped by role_access"
  ON public.chat_groups FOR SELECT TO authenticated
  USING (
    public.has_any_staff_role(auth.uid())
    AND public.user_in_group_role_access(auth.uid(), role_access)
  );

DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.chat_messages;
CREATE POLICY "Staff can view messages scoped by group role_access"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (
    public.has_any_staff_role(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.chat_groups g
      WHERE g.id = chat_messages.group_id
        AND public.user_in_group_role_access(auth.uid(), g.role_access)
    )
  );

-- ============ OPERATIONAL TABLES: restrict SELECT to staff-role users ============
DROP POLICY IF EXISTS "Authenticated users can view tickets" ON public.tickets;
CREATE POLICY "Staff can view tickets"
  ON public.tickets FOR SELECT TO authenticated
  USING (public.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view properties" ON public.properties;
CREATE POLICY "Staff can view properties"
  ON public.properties FOR SELECT TO authenticated
  USING (public.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view inspections" ON public.inspections;
CREATE POLICY "Staff can view inspections"
  ON public.inspections FOR SELECT TO authenticated
  USING (public.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view inspection items" ON public.inspection_items;
CREATE POLICY "Staff can view inspection items"
  ON public.inspection_items FOR SELECT TO authenticated
  USING (public.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view inspection photos" ON public.inspection_photos;
CREATE POLICY "Staff can view inspection photos"
  ON public.inspection_photos FOR SELECT TO authenticated
  USING (public.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view inspection tickets" ON public.inspection_tickets;
CREATE POLICY "Staff can view inspection tickets"
  ON public.inspection_tickets FOR SELECT TO authenticated
  USING (public.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view ticket photos" ON public.ticket_photos;
CREATE POLICY "Staff can view ticket photos"
  ON public.ticket_photos FOR SELECT TO authenticated
  USING (public.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view timeline" ON public.ticket_timeline;
CREATE POLICY "Staff can view timeline"
  ON public.ticket_timeline FOR SELECT TO authenticated
  USING (public.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view estimate options" ON public.ticket_estimate_options;
CREATE POLICY "Staff can view estimate options"
  ON public.ticket_estimate_options FOR SELECT TO authenticated
  USING (public.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view holidays" ON public.holidays;
CREATE POLICY "Staff can view holidays"
  ON public.holidays FOR SELECT TO authenticated
  USING (public.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view company" ON public.company_profile;
CREATE POLICY "Staff can view company"
  ON public.company_profile FOR SELECT TO authenticated
  USING (public.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view email templates" ON public.email_templates;
CREATE POLICY "Staff can view email templates"
  ON public.email_templates FOR SELECT TO authenticated
  USING (public.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view work types" ON public.work_types;
CREATE POLICY "Staff can view work types"
  ON public.work_types FOR SELECT TO authenticated
  USING (public.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view specialties" ON public.specialties;
CREATE POLICY "Staff can view specialties"
  ON public.specialties FOR SELECT TO authenticated
  USING (public.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view ticket templates" ON public.ticket_templates;
CREATE POLICY "Staff can view ticket templates"
  ON public.ticket_templates FOR SELECT TO authenticated
  USING (public.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view inspection item defaults" ON public.inspection_item_defaults;
CREATE POLICY "Staff can view inspection item defaults"
  ON public.inspection_item_defaults FOR SELECT TO authenticated
  USING (public.has_any_staff_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view zones" ON public.zones;
CREATE POLICY "Staff can view zones"
  ON public.zones FOR SELECT TO authenticated
  USING (public.has_any_staff_role(auth.uid()));

-- ============ SECURITY DEFINER cleanup ============
ALTER FUNCTION public.generate_fs_number() SECURITY INVOKER;
ALTER FUNCTION public.generate_ins_number() SECURITY INVOKER;
