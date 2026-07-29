CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
  AND (
    _role <> 'admin'::app_role
    OR EXISTS (
      SELECT 1 FROM public.two_factor_codes
      WHERE user_id = _user_id
        AND used = true
        AND created_at >= now() - interval '30 days'
    )
  )
$$;