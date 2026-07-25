
ALTER TABLE public.inspection_items
  ADD COLUMN IF NOT EXISTS priority text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inspection_items_priority_check'
  ) THEN
    ALTER TABLE public.inspection_items
      ADD CONSTRAINT inspection_items_priority_check
      CHECK (priority IS NULL OR priority IN ('low','medium','high'));
  END IF;
END $$;

-- Expand allowed status values to include 'na'
DO $$
DECLARE
  conname_val text;
BEGIN
  SELECT conname INTO conname_val
  FROM pg_constraint
  WHERE conrelid = 'public.inspection_items'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF conname_val IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.inspection_items DROP CONSTRAINT %I', conname_val);
  END IF;
  ALTER TABLE public.inspection_items
    ADD CONSTRAINT inspection_items_status_check
    CHECK (status IN ('good','needs_repair','urgent','na'));
END $$;

ALTER TABLE public.inspection_photos
  ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.inspection_items(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS marker_x numeric,
  ADD COLUMN IF NOT EXISTS marker_y numeric,
  ADD COLUMN IF NOT EXISTS marker_note text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inspection_photos_marker_x_range') THEN
    ALTER TABLE public.inspection_photos
      ADD CONSTRAINT inspection_photos_marker_x_range CHECK (marker_x IS NULL OR (marker_x >= 0 AND marker_x <= 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inspection_photos_marker_y_range') THEN
    ALTER TABLE public.inspection_photos
      ADD CONSTRAINT inspection_photos_marker_y_range CHECK (marker_y IS NULL OR (marker_y >= 0 AND marker_y <= 1));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS inspection_photos_item_id_idx
  ON public.inspection_photos(item_id) WHERE item_id IS NOT NULL;
