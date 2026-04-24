import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type UserRole = 'super_admin' | 'operations_admin' | 'finance_admin' | 'call_centre_agent' | 'customer' | 'driver' | 'transporter' | 'agent' | 'agency' | 'warehouse_partner' | 'sgr_operator';

interface User {
  id: string;
  role: UserRole;
  email: string;
  phone: string;
  full_name: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      login: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),
      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
    }),
    {
      name: 'zito-auth-storage',
    }
  )
);