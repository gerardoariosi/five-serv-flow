
-- 1) Tighten chat role gating: NULL/empty role_access = admin-only, not all staff
CREATE OR REPLACE FUNCTION public.user_in_group_role_access(_user_id uuid, _role_access text[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR (
      _role_access IS NOT NULL
      AND COALESCE(array_length(_role_access, 1), 0) > 0
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = _user_id
          AND ur.role::text = ANY(_role_access)
      )
    )
$$;

-- Replace chat_groups SELECT policy: drop broad staff bypass
DROP POLICY IF EXISTS "Staff can view chat groups scoped by role_access" ON public.chat_groups;
CREATE POLICY "Staff can view chat groups scoped by role_access"
ON public.chat_groups
FOR SELECT
TO authenticated
USING (public.user_in_group_role_access(auth.uid(), role_access));

-- Replace chat_messages SELECT policy similarly
DROP POLICY IF EXISTS "Staff can view messages scoped by group role_access" ON public.chat_messages;
CREATE POLICY "Staff can view messages scoped by group role_access"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_groups g
    WHERE g.id = chat_messages.group_id
      AND public.user_in_group_role_access(auth.uid(), g.role_access)
  )
);

-- 2) Remove always-true audit_log INSERT policy; trigger runs SECURITY DEFINER as owner and bypasses RLS
DROP POLICY IF EXISTS "Triggers can insert audit log" ON public.audit_log;

-- 3) Revoke EXECUTE from PUBLIC/authenticated on internal trigger function
REVOKE EXECUTE ON FUNCTION public.log_audit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_audit() FROM authenticated;
