import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from './types';

interface AuthState {
  token: string | null;
  user: User | null;
  rememberedEmail: string | null;
  isAuthenticated: boolean;

  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  setRememberedEmail: (email: string | null) => void;
}

/**
 * Zustand store for authentication state
 * Persists token, user, and remembered email to localStorage
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      rememberedEmail: null,
      isAuthenticated: false,

      setAuth: (token, user) => {
        // Set cookie for middleware to read
        document.cookie = `binly-auth-token=${token}; path=/; max-age=${60 * 60 * 24 * 7}`; // 7 days
        set({ token, user, isAuthenticated: true });
      },

      clearAuth: () => {
        // Clear cookie
        document.cookie = 'binly-auth-token=; path=/; max-age=0';
        set({ token: null, user: null, isAuthenticated: false });
      },

      setRememberedEmail: (email) =>
        set({ rememberedEmail: email }),
    }),
    {
      name: 'binly-auth-storage',
    }
  )
);
