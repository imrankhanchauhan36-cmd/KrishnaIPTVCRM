import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '../types';
import {
  clearSession,
  getStoredSession,
  logoutApi,
  markPwaInstalled,
  setSessionExpiredHandler,
  storeSession,
} from '../services/api';

const PWA_INSTALL_REPORTED_KEY = 'krishna_customer_pwa_install_reported';

// True only when the app is actually running from an installed home screen
// icon (not a regular browser tab) — standard `display-mode` media query
// on Android/desktop Chrome, `navigator.standalone` for iOS Safari, which
// never fires the media query at all.
const isRunningStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (window.navigator as unknown as { standalone?: boolean }).standalone === true;

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

  // Reported once per browser (localStorage flag), not once per app open —
  // avoids a network call on every launch once the backend already knows.
  useEffect(() => {
    if (!session) return;
    if (localStorage.getItem(PWA_INSTALL_REPORTED_KEY)) return;
    if (!isRunningStandalone()) return;

    markPwaInstalled()
      .then(() => localStorage.setItem(PWA_INSTALL_REPORTED_KEY, 'true'))
      .catch(() => {
        // Best-effort — try again next launch if it failed (flag not set).
      });
  }, [session]);

  return <AuthContext.Provider value={{ session, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
