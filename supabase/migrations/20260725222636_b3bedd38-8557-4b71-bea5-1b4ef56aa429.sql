-- Allow accounting role to read vendor rows so the Vendor Payables tab
-- (which uses a required inner join from vendor_payments -> technicians_vendors)
-- doesn't silently drop pending payments for accounting users.
CREATE POLICY "Accounting can view vendor rows"
ON public.technicians_vendors
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'accounting'::app_role)
  AND type = 'vendor'
);