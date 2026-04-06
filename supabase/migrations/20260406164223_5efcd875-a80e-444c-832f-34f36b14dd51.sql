
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'supervisor', 'technician', 'accounting');

-- User roles table for RLS
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Users table
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  roles TEXT[],
  is_locked BOOLEAN DEFAULT FALSE,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  require_password_change BOOLEAN DEFAULT FALSE,
  last_active_at TIMESTAMPTZ,
  language TEXT DEFAULT 'en',
  dark_mode BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Company profile
CREATE TABLE public.company_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT,
  contact_email TEXT,
  phone TEXT,
  city TEXT,
  physical_address TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  setup_completed BOOLEAN DEFAULT FALSE
);
ALTER TABLE public.company_profile ENABLE ROW LEVEL SECURITY;

-- Clients
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT,
  contact_name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  type TEXT CHECK (type IN ('pm', 'residential')),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Zones
CREATE TABLE public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

-- Properties
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  address TEXT UNIQUE,
  zone_id UUID REFERENCES public.zones(id),
  current_pm_id UUID REFERENCES public.clients(id),
  previous_pm_id UUID REFERENCES public.clients(id),
  pm_changed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active'
);
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Technicians / Vendors
CREATE TABLE public.technicians_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT CHECK (type IN ('technician', 'vendor')),
  user_id UUID REFERENCES public.users(id),
  company_name TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  specialties TEXT[],
  license_number TEXT,
  insurance_info TEXT,
  status TEXT DEFAULT 'active',
  notes TEXT
);
ALTER TABLE public.technicians_vendors ENABLE ROW LEVEL SECURITY;

-- Inspections
CREATE TABLE public.inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ins_number TEXT UNIQUE,
  client_id UUID REFERENCES public.clients(id),
  property_id UUID REFERENCES public.properties(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','pm_responded','estimate_approved','converted','closed_internally')),
  visit_date DATE,
  bedrooms INT,
  bathrooms INT,
  living_rooms INT,
  has_garage BOOLEAN DEFAULT FALSE,
  has_laundry BOOLEAN DEFAULT FALSE,
  has_exterior BOOLEAN DEFAULT FALSE,
  pm_link_token UUID UNIQUE DEFAULT gen_random_uuid(),
  pm_submitted_at TIMESTAMPTZ,
  pm_signature_data TEXT,
  pm_total_selected DECIMAL,
  master_pin_used TEXT,
  link_opened_count INT DEFAULT 0,
  link_expires_at TIMESTAMPTZ,
  all_good BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

-- Tickets
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fs_number TEXT UNIQUE,
  client_id UUID REFERENCES public.clients(id),
  property_id UUID REFERENCES public.properties(id),
  zone_id UUID REFERENCES public.zones(id),
  unit TEXT,
  work_type TEXT CHECK (work_type IN ('make_ready','repair','emergency','capex')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal','urgent','emergency')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','open','in_progress','paused','ready_for_review','rejected','closed','cancelled')),
  technician_id UUID REFERENCES public.users(id),
  vendor_id UUID REFERENCES public.technicians_vendors(id),
  appointment_time TIMESTAMPTZ,
  work_started_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id),
  description TEXT,
  internal_note TEXT,
  quote_reference TEXT,
  related_inspection_id UUID REFERENCES public.inspections(id),
  rejection_count INT DEFAULT 0,
  billing_status TEXT DEFAULT 'pending',
  qb_invoice_number TEXT,
  accounting_notes TEXT,
  is_draft_auto_saved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Ticket photos
CREATE TABLE public.ticket_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  technician_id UUID REFERENCES public.users(id),
  stage TEXT CHECK (stage IN ('start','process','close')),
  url TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  is_pending_sync BOOLEAN DEFAULT FALSE
);
ALTER TABLE public.ticket_photos ENABLE ROW LEVEL SECURITY;

-- Ticket timeline
CREATE TABLE public.ticket_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES public.users(id),
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ticket_timeline ENABLE ROW LEVEL SECURITY;

-- Inspection items
CREATE TABLE public.inspection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID REFERENCES public.inspections(id) ON DELETE CASCADE,
  area TEXT,
  item_name TEXT,
  status TEXT DEFAULT 'good' CHECK (status IN ('good','needs_repair','urgent')),
  quantity INT DEFAULT 1,
  unit_price DECIMAL DEFAULT 0,
  subtotal DECIMAL,
  pm_selected BOOLEAN DEFAULT FALSE,
  pm_note TEXT
);
ALTER TABLE public.inspection_items ENABLE ROW LEVEL SECURITY;

-- Inspection tickets (link table)
CREATE TABLE public.inspection_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID REFERENCES public.inspections(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.inspection_tickets ENABLE ROW LEVEL SECURITY;

-- Holidays
CREATE TABLE public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  date DATE,
  is_federal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Chat groups
CREATE TABLE public.chat_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  is_fixed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;

-- Chat messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id),
  content TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- User saved filters
CREATE TABLE public.user_saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT,
  filters JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_saved_filters ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_roles
CREATE POLICY "Authenticated users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for users
CREATE POLICY "Authenticated users can view users" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage users" ON public.users FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for company_profile
CREATE POLICY "Authenticated users can view company" ON public.company_profile FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage company" ON public.company_profile FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for clients
CREATE POLICY "Authenticated users can view clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and supervisors can manage clients" ON public.clients FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));

-- RLS Policies for zones
CREATE POLICY "Authenticated users can view zones" ON public.zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage zones" ON public.zones FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for properties
CREATE POLICY "Authenticated users can view properties" ON public.properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and supervisors can manage properties" ON public.properties FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));

-- RLS Policies for technicians_vendors
CREATE POLICY "Authenticated users can view technicians_vendors" ON public.technicians_vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage technicians_vendors" ON public.technicians_vendors FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for tickets
CREATE POLICY "Authenticated users can view tickets" ON public.tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create tickets" ON public.tickets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update tickets" ON public.tickets FOR UPDATE TO authenticated USING (true);

-- RLS Policies for ticket_photos
CREATE POLICY "Authenticated users can view ticket photos" ON public.ticket_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can upload ticket photos" ON public.ticket_photos FOR INSERT TO authenticated WITH CHECK (true);

-- RLS Policies for ticket_timeline
CREATE POLICY "Authenticated users can view timeline" ON public.ticket_timeline FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can add timeline entries" ON public.ticket_timeline FOR INSERT TO authenticated WITH CHECK (true);

-- RLS Policies for inspections
CREATE POLICY "Authenticated users can view inspections" ON public.inspections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and supervisors can manage inspections" ON public.inspections FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));

-- RLS Policies for inspection_items
CREATE POLICY "Authenticated users can view inspection items" ON public.inspection_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage inspection items" ON public.inspection_items FOR ALL TO authenticated USING (true);

-- RLS Policies for inspection_tickets
CREATE POLICY "Authenticated users can view inspection tickets" ON public.inspection_tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage inspection tickets" ON public.inspection_tickets FOR ALL TO authenticated USING (true);

-- RLS Policies for holidays
CREATE POLICY "Authenticated users can view holidays" ON public.holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage holidays" ON public.holidays FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for chat_groups
CREATE POLICY "Authenticated users can view chat groups" ON public.chat_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage chat groups" ON public.chat_groups FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for chat_messages
CREATE POLICY "Authenticated users can view messages" ON public.chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can send messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (true);

-- RLS Policies for user_saved_filters
CREATE POLICY "Users can view own filters" ON public.user_saved_filters FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own filters" ON public.user_saved_filters FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('ticket-photos', 'ticket-photos', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('inspection-photos', 'inspection-photos', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true);

-- Storage policies
CREATE POLICY "Authenticated users can view ticket photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ticket-photos');
CREATE POLICY "Authenticated users can upload ticket photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ticket-photos');

CREATE POLICY "Authenticated users can view inspection photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'inspection-photos');
CREATE POLICY "Authenticated users can upload inspection photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'inspection-photos');

CREATE POLICY "Anyone can view profile photos" ON storage.objects FOR SELECT USING (bucket_id = 'profile-photos');
CREATE POLICY "Authenticated users can upload profile photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-photos');
CREATE POLICY "Authenticated users can update profile photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'profile-photos');
