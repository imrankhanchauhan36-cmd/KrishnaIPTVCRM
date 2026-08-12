import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '../types';
import { clearSession, getStoredSession, logoutApi, setSessionExpiredHandler, storeSession } from '../services/api';

interface AuthContextValue {
  session: Session | null;
  login: (session: Session) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(() => getStoredSession());

  const login = useCallback((newSession: Session) => {
    storeSession(newSession);
    setSession(newSession);
  }, []);

  const logout = useCallback(async () => {
    if (session) {
      try {
        await logoutApi(session.refreshToken);
      } catch {
        // Best-effort — clear the local session regardless of network state.
      }
    }
    clearSession();
    setSession(null);
  }, [session]);

  useEffect(() => {
    setSessionExpiredHandler(() => setSession(null));
    return () => setSessionExpiredHandler(null);
  }, []);

  return <AuthContext.Provider value={{ session, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
