
-- 1. Add columns to tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS billing_flow TEXT DEFAULT 'direct_invoice',
  ADD COLUMN IF NOT EXISTS evaluation_description TEXT,
  ADD COLUMN IF NOT EXISTS evaluation_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estimate_problem_description TEXT,
  ADD COLUMN IF NOT EXISTS estimate_link_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS estimate_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estimate_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estimate_selected_option TEXT,
  ADD COLUMN IF NOT EXISTS estimate_selected_price NUMERIC,
  ADD COLUMN IF NOT EXISTS estimate_pm_signature TEXT,
  ADD COLUMN IF NOT EXISTS estimate_pm_note TEXT,
  ADD COLUMN IF NOT EXISTS estimate_link_opened_count INTEGER DEFAULT 0;

-- Drop existing CHECK on billing_flow if present, then add
DO $$ BEGIN
  ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_billing_flow_check;
EXCEPTION WHEN others THEN NULL; END $$;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_billing_flow_check
  CHECK (billing_flow IN ('direct_invoice', 'estimate_required'));

-- 2. Create ticket_estimate_options table
CREATE TABLE IF NOT EXISTS public.ticket_estimate_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  option_name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ticket_estimate_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view estimate options"
  ON public.ticket_estimate_options
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and supervisors can manage estimate options"
  ON public.ticket_estimate_options
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Public can view estimate options via token"
  ON public.ticket_estimate_options
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_estimate_options.ticket_id
        AND t.estimate_link_token IS NOT NULL
        AND t.estimate_expires_at > now()
    )
  );

-- 3. Allow public to view tickets via estimate token + update on submission
CREATE POLICY "Public can view tickets by estimate token"
  ON public.tickets
  FOR SELECT
  TO anon
  USING (estimate_link_token IS NOT NULL);

CREATE POLICY "Public can update tickets by estimate token"
  ON public.tickets
  FOR UPDATE
  TO anon
  USING (estimate_link_token IS NOT NULL AND estimate_expires_at > now())
  WITH CHECK (estimate_link_token IS NOT NULL AND estimate_expires_at > now());

-- Allow public read of related entities for portal
CREATE POLICY "Public can view properties via estimate token"
  ON public.properties
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.property_id = properties.id
        AND t.estimate_link_token IS NOT NULL
    )
  );

CREATE POLICY "Public can view clients via estimate token"
  ON public.clients
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.client_id = clients.id
        AND t.estimate_link_token IS NOT NULL
    )
  );

CREATE POLICY "Public can view ticket photos via estimate token"
  ON public.ticket_photos
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_photos.ticket_id
        AND t.estimate_link_token IS NOT NULL
        AND t.estimate_expires_at > now()
    )
  );

-- 4. Trigger: notify admins/supervisors when PM approves estimate
CREATE OR REPLACE FUNCTION public.notify_estimate_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.estimate_submitted_at IS NOT NULL
     AND OLD.estimate_submitted_at IS NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    SELECT ur.user_id, 'ticket',
      'Estimate Approved',
      COALESCE(NEW.fs_number, 'Ticket') || ' — PM selected ' ||
      COALESCE(NEW.estimate_selected_option, 'option') || ' · $' ||
      COALESCE(NEW.estimate_selected_price::text, '0'),
      '/tickets/' || NEW.id
    FROM public.user_roles ur
    WHERE ur.role IN ('admin', 'supervisor');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_estimate_approved ON public.tickets;
CREATE TRIGGER trg_notify_estimate_approved
  AFTER UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_estimate_approved();

-- 5. Index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_tickets_estimate_token
  ON public.tickets(estimate_link_token)
  WHERE estimate_link_token IS NOT NULL;
