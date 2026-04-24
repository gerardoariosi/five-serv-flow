
CREATE TABLE public.client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_notes_client_id ON public.client_notes(client_id);

ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and supervisors can view client notes"
ON public.client_notes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Admins and supervisors can insert client notes"
ON public.client_notes
FOR INSERT
TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role))
  AND created_by = auth.uid()
);

CREATE POLICY "Admins and supervisors can delete client notes"
ON public.client_notes
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role));
