CREATE OR REPLACE FUNCTION public.generate_fs_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_year text;
  next_seq int;
BEGIN
  current_year := to_char(now() AT TIME ZONE 'America/New_York', 'YYYY');
  SELECT COALESCE(MAX(
    CAST(substring(fs_number from 'FS-' || current_year || '-(\d+)') AS int)
  ), 0) + 1
  INTO next_seq
  FROM tickets
  WHERE fs_number LIKE 'FS-' || current_year || '-%';
  
  RETURN 'FS-' || current_year || '-' || lpad(next_seq::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_ins_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_year text;
  next_seq int;
BEGIN
  current_year := to_char(now() AT TIME ZONE 'America/New_York', 'YYYY');
  SELECT COALESCE(MAX(
    CAST(substring(ins_number from 'INS-' || current_year || '-(\d+)') AS int)
  ), 0) + 1
  INTO next_seq
  FROM inspections
  WHERE ins_number LIKE 'INS-' || current_year || '-%';
  
  RETURN 'INS-' || current_year || '-' || lpad(next_seq::text, 4, '0');
END;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;