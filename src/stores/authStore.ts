import { create } from 'zustand';

export type AppRole = 'admin' | 'supervisor' | 'technician' | 'accounting';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  roles: AppRole[];
  avatar_url?: string | null;
}

interface AuthState {
  user: UserProfile | null;
  activeRole: AppRole | null;
  isLoading: boolean;
  setUser: (user: UserProfile | null) => void;
  setActiveRole: (role: AppRole) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

const ACTIVE_ROLE_KEY = 'fiveserv-active-role';

const readStoredRole = (): AppRole | null => {
  try {
    const v = localStorage.getItem(ACTIVE_ROLE_KEY);
    if (v === 'admin' || v === 'supervisor' || v === 'technician' || v === 'accounting') return v;
  } catch { /* SSR / privacy */ }
  return null;
};

const resolveInitialRole = (user: UserProfile | null): AppRole | null => {
  if (!user || !user.roles?.length) return null;
  const stored = readStoredRole();
  if (stored && user.roles.includes(stored)) return stored;
  return user.roles[0];
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  activeRole: null,
  isLoading: true,
  setUser: (user) =>
    set({
      user,
      activeRole: resolveInitialRole(user),
    }),
  setActiveRole: (role) => {
    try { localStorage.setItem(ACTIVE_ROLE_KEY, role); } catch { /* ignore */ }
    set({ activeRole: role });
  },
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => {
    try { localStorage.removeItem(ACTIVE_ROLE_KEY); } catch { /* ignore */ }
    set({ user: null, activeRole: null, isLoading: false });
  },
}));
