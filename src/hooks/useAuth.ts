import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore, type AppRole } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

export const useAuth = () => {
  const navigate = useNavigate();
  const { setUser, setLoading, logout: storeLogout } = useAuthStore();

  const fetchUserProfile = useCallback(async (authUserId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, roles, dark_mode')
      .eq('email', (await supabase.auth.getUser()).data.user?.email ?? '')
      .maybeSingle();

    if (error || !data) return null;

    // Sync theme from DB
    if (data.dark_mode !== null && data.dark_mode !== undefined) {
      useThemeStore.getState().setDark(data.dark_mode);
    }

    return {
      id: data.id,
      full_name: data.full_name ?? '',
      email: data.email ?? '',
      roles: (data.roles ?? []) as AppRole[],
    };
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          if (profile) {
            setUser(profile);
          }
        } else {
          storeLogout();
        }
        setLoading(false);
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const profile = await fetchUserProfile(session.user.id);
      if (profile) {
        setUser(profile);
      }
    }
    setLoading(false);

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
        const updates: Record<string, unknown> = { failed_login_attempts: newAttempts };
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
    const profile = await fetchUserProfile(data.user.id);
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
