
-- Create dedicated table for inspection photos
CREATE TABLE public.inspection_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id UUID NOT NULL,
  area TEXT NOT NULL,
  url TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view inspection photos"
ON public.inspection_photos FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins and supervisors can manage inspection photos"
ON public.inspection_photos FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Users can upload inspection photos as themselves"
ON public.inspection_photos FOR INSERT TO authenticated
WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users can delete own inspection photos"
ON public.inspection_photos FOR DELETE TO authenticated
USING (uploaded_by = auth.uid());

-- Index for fast lookups
CREATE INDEX idx_inspection_photos_inspection_id ON public.inspection_photos (inspection_id);
