import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import TopNav from './TopNav';
import DrawerMenu from './DrawerMenu';
import SessionExpiredModal from '@/components/auth/SessionExpiredModal';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Spinner from '@/components/ui/Spinner';

const AppLayout = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const logout = useAuthStore((s) => s.logout);
  const { initialize } = useAuth();

  useEffect(() => {
    const cleanup = initialize();
    return () => {
      cleanup.then((unsub) => unsub?.());
    };
  }, [initialize]);

  const handleExpire = useCallback(() => {
    // Save email for pre-fill
    if (user?.email) {
      localStorage.setItem('fiveserv-last-email', user.email);
    }
    setSessionExpired(true);
  }, [user?.email]);

  useSessionTimeout(handleExpire);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

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
