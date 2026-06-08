'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { getToken, setToken, clearToken, getMe } from '@/services/api';
import type { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  ready: boolean; // finished checking the stored token
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Validate any stored token on first load. setReady runs only inside the
  // promise chain (never synchronously in the effect body).
  useEffect(() => {
    const token = getToken();
    const check = token
      ? getMe().then((u) => setUser(u)).catch(() => clearToken())
      : Promise.resolve();
    check.finally(() => setReady(true));
  }, []);

  const login = (token: string, u: User) => {
    setToken(token);
    setUser(u);
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  const updateUser = (u: User) => setUser(u);

  return (
    <AuthContext.Provider value={{ user, ready, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
