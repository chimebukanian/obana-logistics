import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  phone: string;
  account_type: 'customer' | 'driver' | 'admin' | 'agent';
  first_name?: string;
  last_name?: string;
  attributes?: any;
}

export interface AuthState {
  user: User | null;
  access_token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  setUser: (user: User | null) => void;
  getUser: () => User;
  setAccessToken: (token: string | null) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      access_token: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      setUser: (user) => set({ user }),
      // getUser: () => localStorage.getItem('user'),
      // the above has issues: Type 'string | null' is not assignable to type 'User'.
//   Type 'null' is not assignable to type 'User'.ts(2322)
// authStore.ts(22, 12): The expected type comes from the return type of this signature.
// var localStorage: Storage, fix below:
      getUser: () => {
        // const user = localStorage.getItem('user');
        // the above has: localStorage is not defined, fix below
        const user = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
        return user ? JSON.parse(user) : null;
      },
      setAccessToken: (access_token) => set({ access_token }),
      setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      logout: () => {
        set({
          user: null,
          access_token: null,
          isAuthenticated: false,
          error: null,
        });
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      },
      hydrate: () => {
        const token = localStorage.getItem('access_token');
        const user = localStorage.getItem('user');
        if (token && user) {
          set({
            access_token: token,
            user: JSON.parse(user),
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
