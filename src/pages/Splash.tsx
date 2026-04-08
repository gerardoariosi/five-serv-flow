import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/stores/authStore';
import Spinner from '@/components/ui/Spinner';

const Splash = () => {
  const navigate = useNavigate();
  const { setUser, setLoading } = useAuthStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger fade-in
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        setTimeout(() => navigate('/login', { replace: true }), 800);
        return;
      }

      // Fetch user profile
      const { data: profile } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('email', session.user.email ?? '')
        .maybeSingle();

      if (!profile) {
        setTimeout(() => navigate('/login', { replace: true }), 800);
        return;
      }

      // Read roles from user_roles (single source of truth)
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profile.id);

      const roles = (rolesData ?? []).map(r => r.role) as AppRole[];

      setUser({
        id: profile.id,
        full_name: profile.full_name ?? '',
        email: profile.email ?? '',
        roles,
      });
      setLoading(false);

      // Check if setup is completed
      if (isAdmin) {
        const { data: company } = await supabase
          .from('company_profile')
          .select('setup_completed')
          .maybeSingle();

        if (!company?.setup_completed) {
          setTimeout(() => navigate('/setup/step-1', { replace: true }), 800);
          return;
        }
      }

      // Redirect to dashboard (placeholder for now)
      setTimeout(() => navigate('/dashboard', { replace: true }), 800);
    };

    checkSession();
  }, [navigate, setUser, setLoading]);

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-6">
      <span
        className={`text-8xl font-extrabold text-primary transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        FS
      </span>
      <Spinner size="sm" />
    </div>
  );
};

export default Splash;
