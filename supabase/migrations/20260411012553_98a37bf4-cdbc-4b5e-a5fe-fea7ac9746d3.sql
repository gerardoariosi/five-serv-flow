
-- Create storage bucket for inspection report PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('inspection-reports', 'inspection-reports', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload PDFs
CREATE POLICY "Authenticated users can upload inspection reports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'inspection-reports');

-- Allow public read access (for download links)
CREATE POLICY "Public can read inspection reports"
ON storage.objects FOR SELECT
USING (bucket_id = 'inspection-reports');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete inspection reports"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'inspection-reports');
