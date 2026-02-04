import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuthStore } from './authStore';
import { apiClient } from './api';

interface AuthContextType {
  user: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  signup: (email: string, phone: string, password: string, role: string) => Promise<any>;
  login: (userIdentification: string, password: string, rememberMe?: boolean) => Promise<any>;
  verifyOtp: (requestId: string, otp: string) => Promise<any>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const store = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    store.hydrate();
  }, []);

  const signup = async (email: string, phone: string, password: string, role: string) => {
    try {
      setError(null);
      const response = await apiClient.signup(email, phone, password, role);
      return response.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Signup failed';
      setError(errorMsg);
      throw err;
    }
  };

  const login = async (userIdentification: string, password: string, rememberMe: boolean = false) => {
    try {
      setError(null);
      const response = await apiClient.login(userIdentification, password, rememberMe);
      return response.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Login failed';
      setError(errorMsg);
      throw err;
    }
  };

  const verifyOtp = async (requestId: string, otp: string) => {
    try {
      setError(null);
      const response = await apiClient.verifyOtp(requestId, otp);
      
      if (response.data) {
        const { user, access_token, refresh_token } = response.data;
        store.setUser(user);
        store.setAccessToken(access_token);
        store.setAuthenticated(true);
        localStorage.setItem('user', JSON.stringify(user));
      }
      
      return response.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'OTP verification failed';
      setError(errorMsg);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await apiClient.logout();
      store.logout();
      setError(null);
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user: store.user,
        isAuthenticated: store.isAuthenticated,
        isLoading: store.isLoading,
        error: error || store.error,
        signup,
        login,
        verifyOtp,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
