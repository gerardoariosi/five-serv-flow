import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import TopNav from './TopNav';
import DrawerMenu from './DrawerMenu';
import SessionExpiredModal from '@/components/auth/SessionExpiredModal';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/integrations/supabase/client';

const AppLayout = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleExpire = useCallback(() => {
    // Save email for pre-fill
    if (user?.email) {
      localStorage.setItem('fiveserv-last-email', user.email);
    }
    setSessionExpired(true);
  }, [user?.email]);

  useSessionTimeout(handleExpire);

  const handleSignIn = async () => {
    setSessionExpired(false);
    await supabase.auth.signOut();
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav onMenuClick={() => setDrawerOpen(true)} />
      <DrawerMenu open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <main className="flex-1">
        <Outlet />
      </main>
      <SessionExpiredModal open={sessionExpired} onSignIn={handleSignIn} />
    </div>
  );
};

export default AppLayout;
