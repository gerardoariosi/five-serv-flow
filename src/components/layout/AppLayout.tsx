import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import TopNav from './TopNav';
import DrawerMenu from './DrawerMenu';
import MobileBottomNav from './MobileBottomNav';
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
  const activeRole = useAuthStore((s) => s.activeRole);
  const isLoading = useAuthStore((s) => s.isLoading);
  const logout = useAuthStore((s) => s.logout);
  const { initialize } = useAuth();

  useEffect(() => {
    const cleanup = initialize();
    return () => { cleanup.then((unsub) => unsub?.()); };
  }, [initialize]);

  useEffect(() => {
    if (isLoading || !user) return;
    const rememberMe = localStorage.getItem('fiveserv-remember-me');
    const sessionActive = sessionStorage.getItem('fiveserv-session-active');
    if (!rememberMe && !sessionActive) {
      supabase.auth.signOut().then(() => {
        logout();
        navigate('/login', { replace: true });
      });
    }
  }, [isLoading, user, logout, navigate]);

  const handleExpire = useCallback(() => {
    if (user?.email) localStorage.setItem('fiveserv-last-email', user.email);
    setSessionExpired(true);
  }, [user?.email]);

  useEffect(() => {
    if (!isLoading && !user) navigate('/login', { replace: true });
  }, [isLoading, user, navigate]);

  // Global keyboard shortcuts
  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (drawerOpen) setDrawerOpen(false);
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'n' || e.key === 'N') {
        if (activeRole === 'admin' || activeRole === 'supervisor') {
          e.preventDefault();
          navigate('/tickets/new');
        }
      } else if (e.key === '/') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('focus-search'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, activeRole, drawerOpen]);

  useSessionTimeout(handleExpire);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const handleSignIn = async () => {
    setSessionExpired(false);
    await supabase.auth.signOut();
    logout();
    navigate('/login', { replace: true });
  };

  const isTechnician = activeRole === 'technician';

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav onMenuClick={() => setDrawerOpen(true)} />
      <DrawerMenu open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <main className={`flex-1 overflow-y-auto ${isTechnician ? 'pb-16 md:pb-0' : ''}`}>
        <Outlet />
      </main>
      {isTechnician && <MobileBottomNav />}
      <SessionExpiredModal open={sessionExpired} onSignIn={handleSignIn} />
    </div>
  );
};

export default AppLayout;
