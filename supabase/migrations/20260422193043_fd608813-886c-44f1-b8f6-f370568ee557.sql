ALTER TABLE public.inspections REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inspections;