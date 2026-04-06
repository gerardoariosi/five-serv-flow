
DROP VIEW IF EXISTS public.user_directory;

CREATE OR REPLACE FUNCTION public.get_user_directory()
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.full_name FROM public.users u;
$$;
