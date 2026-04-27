-- 1. Add address column to clients (for residential clients)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address text;

-- 2. Property notes table
CREATE TABLE IF NOT EXISTS public.property_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  tenant_name text,
  tenant_phone text,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS property_notes_property_id_uniq ON public.property_notes(property_id);

ALTER TABLE public.property_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and supervisors can view property notes" ON public.property_notes;
CREATE POLICY "Admins and supervisors can view property notes"
ON public.property_notes FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

DROP POLICY IF EXISTS "Admins and supervisors can manage property notes" ON public.property_notes;
CREATE POLICY "Admins and supervisors can manage property notes"
ON public.property_notes FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_property_notes_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_property_notes_updated_at ON public.property_notes;
CREATE TRIGGER trg_property_notes_updated_at
BEFORE UPDATE ON public.property_notes
FOR EACH ROW EXECUTE FUNCTION public.touch_property_notes_updated_at();