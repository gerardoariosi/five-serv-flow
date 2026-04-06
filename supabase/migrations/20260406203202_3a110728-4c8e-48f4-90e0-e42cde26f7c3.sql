
DROP VIEW IF EXISTS public.user_directory;
CREATE VIEW public.user_directory WITH (security_invoker = true) AS
  SELECT id, full_name FROM public.users;
GRANT SELECT ON public.user_directory TO authenticated;
