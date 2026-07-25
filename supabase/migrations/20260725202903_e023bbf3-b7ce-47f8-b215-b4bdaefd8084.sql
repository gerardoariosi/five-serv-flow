
-- PHASE 2
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='clients_type_check') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_type_check CHECK (type IN ('pm','residential')) NOT VALID;
    ALTER TABLE public.clients VALIDATE CONSTRAINT clients_type_check;
  END IF;
END $$;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS referred_by text,
  ADD COLUMN IF NOT EXISTS lead_source text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='clients_lead_source_check') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_lead_source_check
      CHECK (lead_source IS NULL OR lead_source IN ('referral','google','social','other'));
  END IF;
END $$;

-- PHASE 3A
ALTER TABLE public.technicians_vendors
  ADD COLUMN IF NOT EXISTS license_expiration_date date,
  ADD COLUMN IF NOT EXISTS insurance_expiration_date date;

-- PHASE 3B
CREATE TABLE IF NOT EXISTS public.vendor_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.technicians_vendors(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('w9','insurance','contract','other')),
  file_path text NOT NULL,
  file_name text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_documents TO authenticated;
GRANT ALL ON public.vendor_documents TO service_role;
ALTER TABLE public.vendor_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and supervisors can view vendor documents" ON public.vendor_documents;
CREATE POLICY "Admins and supervisors can view vendor documents"
  ON public.vendor_documents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role));

DROP POLICY IF EXISTS "Admins and supervisors can insert vendor documents" ON public.vendor_documents;
CREATE POLICY "Admins and supervisors can insert vendor documents"
  ON public.vendor_documents FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'supervisor'::app_role))
             AND uploaded_by = auth.uid());

DROP POLICY IF EXISTS "Admins can delete vendor documents" ON public.vendor_documents;
CREATE POLICY "Admins can delete vendor documents"
  ON public.vendor_documents FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

-- PHASE 3C
CREATE TABLE IF NOT EXISTS public.vendor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.technicians_vendors(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  payment_date date NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_payments TO authenticated;
GRANT ALL ON public.vendor_payments TO service_role;
ALTER TABLE public.vendor_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin supervisor accounting can view vendor payments" ON public.vendor_payments;
CREATE POLICY "Admin supervisor accounting can view vendor payments"
  ON public.vendor_payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'accounting'::app_role)
      OR public.has_role(auth.uid(),'supervisor'::app_role));

DROP POLICY IF EXISTS "Admin and accounting can insert vendor payments" ON public.vendor_payments;
CREATE POLICY "Admin and accounting can insert vendor payments"
  ON public.vendor_payments FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'accounting'::app_role))
             AND created_by = auth.uid());

DROP POLICY IF EXISTS "Admin and accounting can update vendor payments" ON public.vendor_payments;
CREATE POLICY "Admin and accounting can update vendor payments"
  ON public.vendor_payments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'accounting'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'accounting'::app_role));

DROP POLICY IF EXISTS "Admins can delete vendor payments" ON public.vendor_payments;
CREATE POLICY "Admins can delete vendor payments"
  ON public.vendor_payments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_vendor_payments_vendor ON public.vendor_payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_documents_vendor ON public.vendor_documents(vendor_id);

-- PHASE 5
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL CHECK (action IN ('insert','update','delete')),
  table_name text NOT NULL,
  record_id uuid,
  changes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can read audit log" ON public.audit_log;
CREATE POLICY "Only admins can read audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "Triggers can insert audit log" ON public.audit_log;
CREATE POLICY "Triggers can insert audit log"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor_id);

CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text := NULLIF(auth.jwt() ->> 'email','');
  v_changes jsonb;
  v_record_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_changes := to_jsonb(NEW);
    v_record_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(key, jsonb_build_object('old', o.value, 'new', n.value))
      INTO v_changes
    FROM jsonb_each(to_jsonb(OLD)) o
    JOIN jsonb_each(to_jsonb(NEW)) n USING (key)
    WHERE o.value IS DISTINCT FROM n.value;
    v_record_id := NEW.id;
    IF v_changes IS NULL OR v_changes = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  ELSE
    v_changes := to_jsonb(OLD);
    v_record_id := OLD.id;
  END IF;

  INSERT INTO public.audit_log(actor_id, actor_email, action, table_name, record_id, changes)
  VALUES (v_actor, v_email, lower(TG_OP), TG_TABLE_NAME, v_record_id, v_changes);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_clients ON public.clients;
CREATE TRIGGER trg_audit_clients AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS trg_audit_properties ON public.properties;
CREATE TRIGGER trg_audit_properties AFTER INSERT OR UPDATE OR DELETE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS trg_audit_tickets ON public.tickets;
CREATE TRIGGER trg_audit_tickets AFTER INSERT OR UPDATE OR DELETE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS trg_audit_vendors ON public.technicians_vendors;
CREATE TRIGGER trg_audit_vendors AFTER INSERT OR UPDATE OR DELETE ON public.technicians_vendors
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();
