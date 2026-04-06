INSERT INTO public.company_profile (company_name, contact_email, setup_completed)
VALUES ('FiveServ', 'owner@fiveserv.net', true)
ON CONFLICT DO NOTHING;