-- Add soft-delete columns
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.zones ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.zones ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.technicians_vendors ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.technicians_vendors ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_properties_is_deleted ON public.properties(is_deleted);
CREATE INDEX IF NOT EXISTS idx_zones_is_deleted ON public.zones(is_deleted);
CREATE INDEX IF NOT EXISTS idx_clients_is_deleted ON public.clients(is_deleted);
CREATE INDEX IF NOT EXISTS idx_tickets_is_deleted ON public.tickets(is_deleted);
CREATE INDEX IF NOT EXISTS idx_inspections_is_deleted ON public.inspections(is_deleted);
CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON public.users(is_deleted);
CREATE INDEX IF NOT EXISTS idx_technicians_vendors_is_deleted ON public.technicians_vendors(is_deleted);