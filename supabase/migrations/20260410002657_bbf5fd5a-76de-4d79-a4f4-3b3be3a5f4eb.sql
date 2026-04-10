
-- Create notifications table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update (mark read) their own notifications
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Authenticated users can insert notifications (for app-level inserts)
CREATE POLICY "Authenticated can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- Service role can manage all
CREATE POLICY "Service role full access"
ON public.notifications FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Index for fast queries
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, is_read) WHERE is_read = false;

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger: notify admins+supervisors when a ticket is created
CREATE OR REPLACE FUNCTION public.notify_ticket_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert a notification for every admin and supervisor
  INSERT INTO public.notifications (user_id, type, title, message, link)
  SELECT ur.user_id, 'ticket',
    'New Ticket Created',
    COALESCE(NEW.fs_number, 'Ticket') || ' — ' || COALESCE(NEW.work_type, 'repair'),
    '/tickets/' || NEW.id
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'supervisor')
    AND ur.user_id != COALESCE(NEW.technician_id, '00000000-0000-0000-0000-000000000000');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ticket_created
AFTER INSERT ON public.tickets
FOR EACH ROW
WHEN (NEW.status != 'draft')
EXECUTE FUNCTION public.notify_ticket_created();

-- Trigger: notify on ticket status change
CREATE OR REPLACE FUNCTION public.notify_ticket_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status != 'draft' THEN
    -- Notify admins, supervisors, and assigned technician
    INSERT INTO public.notifications (user_id, type, title, message, link)
    SELECT DISTINCT ur.user_id, 'ticket',
      'Ticket Status Updated',
      COALESCE(NEW.fs_number, 'Ticket') || ': ' || COALESCE(OLD.status, '?') || ' → ' || NEW.status,
      '/tickets/' || NEW.id
    FROM public.user_roles ur
    WHERE ur.role IN ('admin', 'supervisor');

    -- Also notify assigned technician if any
    IF NEW.technician_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (NEW.technician_id, 'ticket',
        'Ticket Status Updated',
        COALESCE(NEW.fs_number, 'Ticket') || ': ' || COALESCE(OLD.status, '?') || ' → ' || NEW.status,
        '/tickets/' || NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ticket_status_change
AFTER UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.notify_ticket_status_change();

-- Trigger: notify admins when inspection PM submits
CREATE OR REPLACE FUNCTION public.notify_inspection_pm_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.pm_submitted_at IS NULL AND NEW.pm_submitted_at IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    SELECT ur.user_id, 'inspection',
      'PM Submitted Inspection',
      COALESCE(NEW.ins_number, 'Inspection') || ' — PM has responded',
      '/inspections/' || NEW.id
    FROM public.user_roles ur
    WHERE ur.role IN ('admin', 'supervisor');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inspection_pm_submitted
AFTER UPDATE ON public.inspections
FOR EACH ROW
EXECUTE FUNCTION public.notify_inspection_pm_submitted();
