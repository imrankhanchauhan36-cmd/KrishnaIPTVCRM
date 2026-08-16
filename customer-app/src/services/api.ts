import type { MeResponse, NotificationItem, Session } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

const STORAGE_KEY = 'krishna_customer_session';

export const getStoredSession = (): Session | null => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
};

export const storeSession = (session: Session) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const clearSession = () => {
  localStorage.removeItem(STORAGE_KEY);
};

const authHeaders = (): Record<string, string> => {
  const session = getStoredSession();
  return session ? { Authorization: `Bearer ${session.accessToken}` } : {};
};

// Lets AuthContext know a stored session was rejected by the server, so it
// can drop back to the Login screen instead of leaving the user stuck on a
// dead-end error message with an invalid token still in localStorage.
let onSessionExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (handler: (() => void) | null) => {
  onSessionExpired = handler;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const hadSession = !!getStoredSession();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && hadSession) {
      clearSession();
      onSessionExpired?.();
    }
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data as T;
}

// ===== Auth =====
export const requestOtp = (phone: string) =>
  request<{ message: string; customerId: string; expiresInSeconds: number; otp?: string }>('/customer-auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });

export const verifyOtp = (phone: string, otp: string) =>
  request<{ accessToken: string; refreshToken: string; customer: Session['customer'] }>('/customer-auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp }),
  });

export const logoutApi = (refreshToken: string) =>
  request<{ message: string }>('/customer-auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });

export const getMe = () => request<MeResponse>('/customer-auth/me');

export const markPwaInstalled = () =>
  request<{ pwaInstalledAt: string }>('/customer-auth/me/mark-installed', { method: 'PATCH' });

// ===== Notifications =====
export const getMyNotifications = () =>
  request<{ notifications: NotificationItem[]; total: number }>('/notifications/me');

export const getMyUnreadCount = () => request<{ unreadCount: number }>('/notifications/me/unread-count');

export const markAllMineAsRead = () =>
  request<{ matched: number; updated: number }>('/notifications/me/read-all', { method: 'PATCH' });

// ===== Push =====
export const registerMyPushToken = (token: string, platform: 'web', previousToken?: string) =>
  request<{ _id: string }>('/push-tokens/me', {
    method: 'POST',
    body: JSON.stringify({ token, platform, previousToken }),
  });
