-- Redefine the setup gate to close as soon as any admin exists in the system.
-- Previously it only checked company_profile.setup_completed, which is a
-- client-writable flag that leaves a race window allowing a visitor to
-- self-assign the admin role. Anchoring the gate to the existence of ANY
-- admin in user_roles makes it single-use and atomic.
CREATE OR REPLACE FUNCTION public.is_initial_setup_open()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'::app_role
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.company_profile WHERE COALESCE(setup_completed, false) = true
  );
$$;
