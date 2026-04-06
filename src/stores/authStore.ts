import { create } from 'zustand';

export type AppRole = 'admin' | 'supervisor' | 'technician' | 'accounting';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  roles: AppRole[];
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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  activeRole: null,
  isLoading: true,
  setUser: (user) =>
    set({
      user,
      activeRole: user?.roles?.[0] ?? null,
    }),
  setActiveRole: (role) => set({ activeRole: role }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null, activeRole: null, isLoading: false }),
}));
