
-- 1. Revoke EXECUTE on internal trigger function
REVOKE EXECUTE ON FUNCTION public.enforce_accounting_ticket_column_scope() FROM PUBLIC, anon, authenticated;

-- 2. Restrict clients SELECT
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;

CREATE POLICY "Admin supervisor accounting can view clients"
ON public.clients FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'accounting'::app_role)
);

CREATE POLICY "Technicians can view clients for assigned tickets"
ON public.clients FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'technician'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.client_id = clients.id AND t.technician_id = auth.uid()
  )
);

-- 3. Restrict technicians_vendors SELECT
DROP POLICY IF EXISTS "Authenticated users can view technicians_vendors" ON public.technicians_vendors;

CREATE POLICY "Admin and supervisor can view technicians_vendors"
ON public.technicians_vendors FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
);

-- 4. Add WITH CHECK to accounting ticket UPDATE policy
DROP POLICY IF EXISTS "Accounting can update billing fields" ON public.tickets;

CREATE POLICY "Accounting can update billing fields"
ON public.tickets FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'accounting'::app_role))
WITH CHECK (has_role(auth.uid(), 'accounting'::app_role));
