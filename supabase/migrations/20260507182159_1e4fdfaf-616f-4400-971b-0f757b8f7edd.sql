CREATE OR REPLACE FUNCTION public.get_user_directory()
 RETURNS TABLE(id uuid, full_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT u.id, u.full_name
  FROM public.users u
  WHERE COALESCE(u.is_locked, false) = false
    AND COALESCE(u.is_deleted, false) = false;
$function$;