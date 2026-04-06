import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore, type AppRole } from '@/stores/authStore';

const TIMEOUT_MS: Record<AppRole, number> = {
  admin: 8 * 60 * 60 * 1000,
  supervisor: 12 * 60 * 60 * 1000,
  technician: 24 * 60 * 60 * 1000,
  accounting: 8 * 60 * 60 * 1000,
};

const DB_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const useSessionTimeout = (onExpire: () => void) => {
  const user = useAuthStore((s) => s.user);
  const activeRole = useAuthStore((s) => s.activeRole);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dbTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastDbUpdate = useRef(0);

  const getTimeout = useCallback(() => {
    if (!activeRole) return TIMEOUT_MS.technician;
    return TIMEOUT_MS[activeRole];
  }, [activeRole]);

  const updateLastActive = useCallback(async () => {
    if (!user?.id) return;
    const now = Date.now();
    if (now - lastDbUpdate.current < DB_UPDATE_INTERVAL) return;
    lastDbUpdate.current = now;
    await supabase
      .from('users')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', user.id);
  }, [user?.id]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onExpire();
    }, getTimeout());
    updateLastActive();
  }, [getTimeout, onExpire, updateLastActive]);

  useEffect(() => {
    if (!user) return;

    // Check last_active_at on mount — if expired, logout immediately
    const checkLastActive = async () => {
      const { data } = await supabase
        .from('users')
        .select('last_active_at')
        .eq('id', user.id)
        .maybeSingle();

      if (data?.last_active_at) {
        const elapsed = Date.now() - new Date(data.last_active_at).getTime();
        if (elapsed > getTimeout()) {
          onExpire();
          return;
        }
      }

      // Start the timer
      resetTimer();
    };

    checkLastActive();

    const events = ['click', 'touchstart', 'keydown', 'scroll', 'mousemove'];
    const handler = () => resetTimer();

    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));

    // Periodic DB update every 5 min
    dbTimerRef.current = setInterval(() => {
      updateLastActive();
    }, DB_UPDATE_INTERVAL);

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (dbTimerRef.current) clearInterval(dbTimerRef.current);
    };
  }, [user, resetTimer, getTimeout, onExpire, updateLastActive]);
};
