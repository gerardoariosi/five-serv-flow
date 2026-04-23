-- 1. Trigger: notify assigned technician
CREATE OR REPLACE FUNCTION public.notify_technician_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.technician_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.technician_id IS DISTINCT FROM NEW.technician_id) THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      NEW.technician_id,
      'ticket',
      'New Ticket Assigned',
      COALESCE(NEW.fs_number, 'Ticket') || ' — ' || COALESCE(NEW.work_type, 'work'),
      '/my-work/' || NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_technician_assigned ON public.tickets;
CREATE TRIGGER trg_notify_technician_assigned
AFTER INSERT OR UPDATE OF technician_id ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_technician_assigned();

-- 2. Trigger: notify admins on ready_for_review
CREATE OR REPLACE FUNCTION public.notify_ready_for_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ready_for_review'
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    SELECT ur.user_id, 'ticket',
      'Ticket Ready for Review',
      COALESCE(NEW.fs_number, 'Ticket') || ' is ready for review',
      '/tickets/' || NEW.id
    FROM public.user_roles ur
    WHERE ur.role = 'admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_ready_for_review ON public.tickets;
CREATE TRIGGER trg_notify_ready_for_review
AFTER UPDATE OF status ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_ready_for_review();

-- 3. Checklist progress column
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS checklist_progress jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4. Realtime for ticket_timeline and ticket_photos
ALTER TABLE public.ticket_timeline REPLICA IDENTITY FULL;
ALTER TABLE public.ticket_photos REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_timeline;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_photos;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;