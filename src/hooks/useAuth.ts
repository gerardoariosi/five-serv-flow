import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore, type AppRole } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

export const useAuth = () => {
  const navigate = useNavigate();
  const { setUser, setLoading, logout: storeLogout } = useAuthStore();

  const fetchUserProfile = useCallback(async (authUserId: string, email?: string | null) => {
    let { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, dark_mode, avatar_url')
      .eq('id', authUserId)
      .maybeSingle();

    if ((!data || error) && email) {
      const fallback = await supabase
        .from('users')
        .select('id, full_name, email, dark_mode, avatar_url')
        .eq('email', email)
        .maybeSingle();

      data = fallback.data;
      error = fallback.error;
    }

    if (error || !data) return null;

    // Sync theme from DB
    if (data.dark_mode !== null && data.dark_mode !== undefined) {
      useThemeStore.getState().setDark(data.dark_mode);
    }

    // Read roles from user_roles table (single source of truth for RLS)
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', data.id);

    const roles = (rolesData ?? []).map(r => r.role) as AppRole[];

    return {
      id: data.id,
      full_name: data.full_name ?? '',
      email: data.email ?? '',
      roles,
      avatar_url: data.avatar_url ?? null,
    };
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);

    const syncSession = async (session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id, session.user.email);
        if (profile) {
          setUser(profile);
        } else {
          storeLogout();
        }
      } else {
        storeLogout();
      }

      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        window.setTimeout(() => {
          void syncSession(session);
        }, 0);
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    await syncSession(session);

    return () => subscription.unsubscribe();
  }, [fetchUserProfile, setUser, setLoading, storeLogout]);

  const signIn = async (email: string, password: string) => {
    // Check if user is locked
    const { data: userData } = await supabase
      .from('users')
      .select('is_locked, failed_login_attempts')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (userData?.is_locked) {
      return { error: { message: 'Account locked. Contact your administrator.' } };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (error) {
      // Increment failed attempts
      if (userData) {
        const newAttempts = (userData.failed_login_attempts ?? 0) + 1;
        const updates: { failed_login_attempts: number; is_locked?: boolean } = { failed_login_attempts: newAttempts };
        if (newAttempts >= 5) {
          updates.is_locked = true;
        }
        await supabase
          .from('users')
          .update(updates)
          .eq('email', email.toLowerCase());
      }
      return { error: { message: 'Incorrect email or password.' } };
    }

    // Reset failed attempts on success
    if (userData) {
      await supabase
        .from('users')
        .update({ failed_login_attempts: 0, last_active_at: new Date().toISOString() })
        .eq('email', email.toLowerCase());
    }

    // Fetch profile
    const profile = await fetchUserProfile(data.user.id, data.user.email);
    if (profile) {
      setUser(profile);
    }

    return { error: null, user: profile };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    storeLogout();
    navigate('/login');
  };

  const resetPassword = async (email: string) => {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  };

  return { initialize, signIn, signOut, resetPassword, updatePassword, fetchUserProfile };
};
