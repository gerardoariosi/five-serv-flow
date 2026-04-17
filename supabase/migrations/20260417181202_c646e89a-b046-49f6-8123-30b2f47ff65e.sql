ALTER TABLE public.inspections DROP CONSTRAINT IF EXISTS inspections_status_check;
ALTER TABLE public.inspections ADD CONSTRAINT inspections_status_check
  CHECK (status IN ('draft','scheduled','inspecting','pricing','sent','pm_responded','estimate_approved','converted','closed_internally'));