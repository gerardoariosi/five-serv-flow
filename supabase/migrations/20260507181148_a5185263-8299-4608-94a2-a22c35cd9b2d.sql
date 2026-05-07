
-- IMPROVEMENT 1: Property address split
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS street_address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS full_address text;

UPDATE public.properties
SET street_address = address
WHERE street_address IS NULL AND address IS NOT NULL;

UPDATE public.properties
SET full_address = NULLIF(
  concat_ws(', ',
    NULLIF(street_address, ''),
    NULLIF(city, ''),
    NULLIF(concat_ws(' ', NULLIF(state, ''), NULLIF(zip_code, '')), '')
  ),
'')
WHERE full_address IS NULL;

CREATE OR REPLACE FUNCTION public.sync_property_address()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  computed text;
BEGIN
  computed := NULLIF(
    concat_ws(', ',
      NULLIF(NEW.street_address, ''),
      NULLIF(NEW.city, ''),
      NULLIF(concat_ws(' ', NULLIF(NEW.state, ''), NULLIF(NEW.zip_code, '')), '')
    ),
  '');
  IF computed IS NOT NULL THEN
    NEW.full_address := computed;
    NEW.address := computed;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_property_address_trigger ON public.properties;
CREATE TRIGGER sync_property_address_trigger
BEFORE INSERT OR UPDATE
ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.sync_property_address();

-- IMPROVEMENT 2: Inspection assignee
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS assigned_to uuid;

CREATE OR REPLACE FUNCTION public.notify_inspection_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      NEW.assigned_to,
      'inspection',
      'New Inspection Assigned',
      COALESCE(NEW.ins_number, 'Inspection') || COALESCE(' on ' || NEW.visit_date::text, ''),
      '/inspections/' || NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_inspection_assigned_trigger ON public.inspections;
CREATE TRIGGER notify_inspection_assigned_trigger
AFTER INSERT OR UPDATE OF assigned_to
ON public.inspections
FOR EACH ROW EXECUTE FUNCTION public.notify_inspection_assigned();
