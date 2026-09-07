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

const USER_KEY = 'close_ai_user';

/**
 * The last known identity for this device.
 *
 * Cached so a returning user gets their workspace on first paint instead of
 * waiting on a round trip. The server stays the authority: every request
 * carries the token and the backend authorises it, so a stale cache cannot
 * grant access to anything — it only decides what is painted first.
 */
function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as User;
    return u && typeof u.id === 'number' && typeof u.email === 'string' ? u : null;
  } catch {
    return null;
  }
}

function writeCachedUser(u: User | null): void {
  try {
    if (!u) {
      localStorage.removeItem(USER_KEY);
      return;
    }
    // An explicit allow-list rather than omitting `is_admin`: anything
    // privilege-bearing added to User later must be opted in deliberately, not
    // cached by default. The admin surface waits for a fresh answer from the
    // server rather than trusting whatever this device happens to be holding.
    const safe: Omit<User, 'is_admin'> = {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      avatar: u.avatar,
    };
    localStorage.setItem(USER_KEY, JSON.stringify(safe));
  } catch {
    /* private mode / quota — the session still works for this tab */
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Restore the session on first load. setState only ever runs inside a
  // promise callback here, never synchronously in the effect body, and the
  // first render always matches the server (no user, not ready) so hydration
  // stays consistent.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      Promise.resolve().then(() => setReady(true));
      return;
    }

    // Paint the workspace from the cached identity and revalidate behind it.
    // Blocking the whole UI on this request meant a free-tier backend waking
    // from sleep showed nothing but a logo for half a minute.
    const cached = readCachedUser();
    if (cached) {
      Promise.resolve().then(() => {
        setUser(cached);
        setReady(true);
      });
    }

    getMe()
      .then((u) => {
        setUser(u);
        writeCachedUser(u);
      })
      .catch((err: unknown) => {
        // Only a token the server actually rejects ends the session. Clearing
        // it on any failure meant a cold or unreachable backend silently
        // signed people out, which is the opposite of what a timeout means.
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) {
          clearToken();
          writeCachedUser(null);
          setUser(null);
        }
      })
      .finally(() => setReady(true));
  }, []);

  const login = (token: string, u: User) => {
    setToken(token);
    setUser(u);
    writeCachedUser(u);
  };

  const logout = () => {
    clearToken();
    writeCachedUser(null);
    setUser(null);
  };

  const updateUser = (u: User) => {
    setUser(u);
    writeCachedUser(u);
  };

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
