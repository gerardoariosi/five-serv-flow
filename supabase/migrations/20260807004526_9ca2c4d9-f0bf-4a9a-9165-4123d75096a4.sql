-- Portal data is served exclusively by the PIN-gated `verify-portal-pin` edge
-- function (service role). These anon policies did NOT match the caller's token
-- against the row, so any anonymous request could read/modify every inspection
-- and ticket that merely had a non-null, unexpired link token.
DROP POLICY IF EXISTS "Public can view inspections by token" ON public.inspections;
DROP POLICY IF EXISTS "Public can update inspections by token" ON public.inspections;
DROP POLICY IF EXISTS "Public can view inspection items" ON public.inspection_items;
DROP POLICY IF EXISTS "Public can update inspection items" ON public.inspection_items;
DROP POLICY IF EXISTS "anon_select_inspection_photos_via_token" ON public.inspection_photos;
DROP POLICY IF EXISTS "Public can view tickets by estimate token" ON public.tickets;
DROP POLICY IF EXISTS "Public can update tickets by estimate token" ON public.tickets;
DROP POLICY IF EXISTS "Public can view estimate options via token" ON public.ticket_estimate_options;

-- Bootstrap/setup-wizard escalation path. Setup is complete and admins exist;
-- these anon/authenticated INSERT paths must never be reachable again.
DROP POLICY IF EXISTS "setup wizard can create company profile" ON public.company_profile;
DROP POLICY IF EXISTS "setup wizard can create bootstrap user" ON public.users;
DROP POLICY IF EXISTS "setup wizard can assign bootstrap admin role" ON public.user_roles;

-- Revoke the table-level grants that backed those anon policies.
REVOKE ALL ON public.inspections FROM anon;
REVOKE ALL ON public.inspection_items FROM anon;
REVOKE ALL ON public.inspection_photos FROM anon;
REVOKE ALL ON public.tickets FROM anon;
REVOKE ALL ON public.ticket_estimate_options FROM anon;
REVOKE ALL ON public.company_profile FROM anon;
REVOKE ALL ON public.users FROM anon;
REVOKE ALL ON public.user_roles FROM anon;

-- The setup gate is now permanently closed: no policy depends on it, and it can
-- never re-open a privilege-escalation path.
CREATE OR REPLACE FUNCTION public.is_initial_setup_open()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT false;
$$;