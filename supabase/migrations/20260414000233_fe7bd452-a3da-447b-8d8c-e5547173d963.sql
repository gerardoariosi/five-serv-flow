-- Allow admins to permanently delete tickets
CREATE POLICY "Admins can delete tickets"
ON public.tickets
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete ticket timeline entries
CREATE POLICY "Admins can delete ticket timeline"
ON public.ticket_timeline
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));