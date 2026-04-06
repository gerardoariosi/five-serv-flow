
CREATE TABLE public.specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage specialties" ON public.specialties FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view specialties" ON public.specialties FOR SELECT TO authenticated USING (true);

CREATE TABLE public.work_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  key text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.work_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage work types" ON public.work_types FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view work types" ON public.work_types FOR SELECT TO authenticated USING (true);

INSERT INTO public.work_types (label, key) VALUES
  ('Make-Ready', 'make_ready'),
  ('Emergency', 'emergency'),
  ('Repair', 'repair'),
  ('CapEx', 'capex');

CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  subject text DEFAULT '',
  body text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage email templates" ON public.email_templates FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view email templates" ON public.email_templates FOR SELECT TO authenticated USING (true);

INSERT INTO public.email_templates (template_key, subject, body) VALUES
  ('ticket_created', 'New Ticket Created', 'A new ticket {{fs_number}} has been created for property {{property}}.'),
  ('ready_for_review', 'Ticket Ready for Review', 'Ticket {{fs_number}} is ready for your review.'),
  ('reset_password', 'Reset Your Password', 'Click the link below to reset your password: {{link}}'),
  ('weekly_summary', 'Weekly Summary', 'Here is your weekly operations summary.');

CREATE TABLE public.inspection_item_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL,
  item_name text NOT NULL,
  default_price numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.inspection_item_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage inspection item defaults" ON public.inspection_item_defaults FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view inspection item defaults" ON public.inspection_item_defaults FOR SELECT TO authenticated USING (true);

CREATE TABLE public.ticket_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  work_type text,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ticket_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage ticket templates" ON public.ticket_templates FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view ticket templates" ON public.ticket_templates FOR SELECT TO authenticated USING (true);

CREATE TABLE public.master_pin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pin text NOT NULL DEFAULT '0000',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.master_pin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage master pin" ON public.master_pin FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view master pin" ON public.master_pin FOR SELECT TO authenticated USING (true);

INSERT INTO public.master_pin (pin) VALUES ('0000');
