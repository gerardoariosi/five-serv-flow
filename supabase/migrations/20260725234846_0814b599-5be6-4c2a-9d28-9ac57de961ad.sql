
-- Helper: returns true only while no completed company_profile row exists.
CREATE OR REPLACE FUNCTION public.is_initial_setup_open()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.company_profile WHERE COALESCE(setup_completed, false) = true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_initial_setup_open() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_initial_setup_open() TO anon, authenticated, service_role;

-- company_profile: allow anon INSERT only during initial setup; otherwise admin only.
DROP POLICY IF EXISTS "setup wizard can create company profile" ON public.company_profile;
CREATE POLICY "setup wizard can create company profile"
ON public.company_profile
FOR INSERT
TO anon, authenticated
WITH CHECK (public.is_initial_setup_open());

-- users: allow anon INSERT only during initial setup (for the admin bootstrap row).
DROP POLICY IF EXISTS "setup wizard can create bootstrap user" ON public.users;
CREATE POLICY "setup wizard can create bootstrap user"
ON public.users
FOR INSERT
TO anon, authenticated
WITH CHECK (
  public.is_initial_setup_open()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- user_roles: allow anon INSERT of admin role only during initial setup.
DROP POLICY IF EXISTS "setup wizard can assign bootstrap admin role" ON public.user_roles;
CREATE POLICY "setup wizard can assign bootstrap admin role"
ON public.user_roles
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (public.is_initial_setup_open() AND role = 'admin'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
