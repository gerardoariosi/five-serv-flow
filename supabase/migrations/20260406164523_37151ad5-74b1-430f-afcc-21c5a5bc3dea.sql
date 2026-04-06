
-- Add failed login attempts to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0;

-- 2FA codes table
CREATE TABLE public.two_factor_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT DEFAULT 0,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.two_factor_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own 2fa codes" ON public.two_factor_codes
  FOR SELECT TO authenticated USING (auth.uid()::text = user_id::text);

CREATE POLICY "Service role manages 2fa codes" ON public.two_factor_codes
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
