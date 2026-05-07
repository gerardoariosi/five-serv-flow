ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS clients_email_active_unique
  ON public.clients (lower(email)) WHERE is_deleted = false AND email IS NOT NULL;