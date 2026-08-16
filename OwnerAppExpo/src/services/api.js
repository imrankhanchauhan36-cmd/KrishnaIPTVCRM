import Constants from 'expo-constants';

// ⚙️ SWITCH THIS to control which backend the app talks to:
// true  = Render (production, live 24/7, works anywhere)
// false = Local Mac backend (only works when your Mac is running the server on the same WiFi)
const USE_PRODUCTION = true;

const PRODUCTION_URL = 'https://krishna-iptv-backend.onrender.com/api';

// Automatically detect the computer's current LAN IP from Expo's dev server host
// (only used when USE_PRODUCTION is false, for local development/testing).
const getLocalBaseUrl = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoClient?.hostUri;

  const host = hostUri ? hostUri.split(':')[0] : 'localhost';
  return `http://${host}:5050/api`;
};

const BASE_URL = USE_PRODUCTION ? PRODUCTION_URL : getLocalBaseUrl();

// ===== CUSTOMERS =====
export const getCustomers = async () => {
  const response = await fetch(`${BASE_URL}/customers`);
  if (!response.ok) throw new Error('Failed to fetch customers');
  return response.json();
};

export const getCustomerProfile = async (id) => {
  const response = await fetch(`${BASE_URL}/customers/${id}`);
  if (!response.ok) throw new Error('Failed to fetch customer profile');
  return response.json();
};

export const searchCustomer = async (query) => {
  const response = await fetch(`${BASE_URL}/customers/check-duplicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error('Search failed');
  return response.json();
};

export const createCustomer = async (data) => {
  const url = `${BASE_URL}/customers`;
  console.log('[PHONE-DEBUG] Final API URL:', url); // TEMP — remove after verification
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.message || 'Failed to create customer');
    error.status = response.status;
    error.customer = result.customer;
    throw error;
  }
  return result;
};

export const updateCustomer = async (id, data) => {
  const response = await fetch(`${BASE_URL}/customers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update customer');
  return response.json();
};

export const deleteCustomer = async (id) => {
  const response = await fetch(`${BASE_URL}/customers/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete customer');
  return response.json();
};

export const getCustomerTimeline = async (id) => {
  const response = await fetch(`${BASE_URL}/customers/${id}/timeline`);
  if (!response.ok) throw new Error('Failed to fetch timeline');
  return response.json();
};

// ===== DEVICES =====
export const getDevicesByCustomer = async (customerId) => {
  const response = await fetch(`${BASE_URL}/devices/customer/${customerId}`);
  if (!response.ok) throw new Error('Failed to fetch devices');
  return response.json();
};

export const createDevice = async (data) => {
  const response = await fetch(`${BASE_URL}/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create device');
  return response.json();
};

export const deleteDevice = async (id) => {
  const response = await fetch(`${BASE_URL}/devices/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete device');
  return response.json();
};

// ===== SUBSCRIPTIONS =====
export const getSubscriptionsByCustomer = async (customerId) => {
  const response = await fetch(`${BASE_URL}/subscriptions/customer/${customerId}`);
  if (!response.ok) throw new Error('Failed to fetch subscriptions');
  return response.json();
};

export const createSubscription = async (data) => {
  const response = await fetch(`${BASE_URL}/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.message || 'Failed to create subscription');
    error.status = response.status;
    error.subscription = result.subscription;
    throw error;
  }
  return result;
};

export const updateSubscription = async (id, data) => {
  const response = await fetch(`${BASE_URL}/subscriptions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to update subscription');
  return result;
};

export const deleteSubscription = async (id) => {
  const response = await fetch(`${BASE_URL}/subscriptions/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete subscription');
  return response.json();
};

export const updateSubscriptionStatus = async (id, data) => {
  const response = await fetch(`${BASE_URL}/subscriptions/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to update status');
  return result;
};

// One-time repair for a subscription created before device-linking existed —
// operator picks the device explicitly, never inferred automatically.
export const assignDeviceToSubscription = async (subscriptionId, deviceId) => {
  const response = await fetch(`${BASE_URL}/subscriptions/${subscriptionId}/device`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to assign device');
  return result;
};

// ===== RENEWALS =====
// params: { bucket } or { date } or { from, to }
export const getRenewals = async (params = {}) => {
  const parts = [];
  if (params.bucket) parts.push(`bucket=${encodeURIComponent(params.bucket)}`);
  if (params.date) parts.push(`date=${encodeURIComponent(params.date)}`);
  if (params.from) parts.push(`from=${encodeURIComponent(params.from)}`);
  if (params.to) parts.push(`to=${encodeURIComponent(params.to)}`);
  const response = await fetch(`${BASE_URL}/renewals?${parts.join('&')}`);
  if (!response.ok) throw new Error('Failed to fetch renewals');
  return response.json();
};

// ===== CUSTOMER NOTES =====
export const getCustomerNotes = async (customerId) => {
  const response = await fetch(`${BASE_URL}/customer-notes/customer/${customerId}`);
  if (!response.ok) throw new Error('Failed to fetch notes');
  return response.json();
};

export const createCustomerNote = async (data) => {
  const response = await fetch(`${BASE_URL}/customer-notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to add note');
  return result;
};

// ===== PLANS =====
export const getPlans = async () => {
  const response = await fetch(`${BASE_URL}/plans`);
  if (!response.ok) throw new Error('Failed to fetch plans');
  return response.json();
};

export const createPlan = async (data) => {
  const response = await fetch(`${BASE_URL}/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create plan');
  return response.json();
};

export const updatePlan = async (id, data) => {
  const response = await fetch(`${BASE_URL}/plans/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update plan');
  return response.json();
};

export const deletePlan = async (id) => {
  const response = await fetch(`${BASE_URL}/plans/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete plan');
  return response.json();
};

// ===== EMPLOYEE MASTER =====
export const getActiveEmployees = async () => {
  const response = await fetch(`${BASE_URL}/employee-master`);
  if (!response.ok) throw new Error('Failed to fetch employees');
  return response.json();
};

export const getAllEmployeesForManagement = async () => {
  const response = await fetch(`${BASE_URL}/employee-master?all=true`);
  if (!response.ok) throw new Error('Failed to fetch employees');
  return response.json();
};

export const createEmployee = async (data) => {
  const response = await fetch(`${BASE_URL}/employee-master`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to create employee');
  return result;
};

export const updateEmployee = async (id, data) => {
  const response = await fetch(`${BASE_URL}/employee-master/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to update employee');
  return result;
};

export const deleteEmployee = async (id) => {
  const response = await fetch(`${BASE_URL}/employee-master/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete employee');
  return response.json();
};

// ===== PORTAL MASTER =====
export const getActivePortals = async () => {
  const response = await fetch(`${BASE_URL}/portals`);
  if (!response.ok) throw new Error('Failed to fetch portals');
  return response.json();
};

export const createPortal = async (data) => {
  const response = await fetch(`${BASE_URL}/portals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to create portal');
  return result;
};

export const updatePortal = async (id, data) => {
  const response = await fetch(`${BASE_URL}/portals/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to update portal');
  return result;
};

export const deletePortal = async (id) => {
  const response = await fetch(`${BASE_URL}/portals/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete portal');
  return response.json();
};

export const updateDevice = async (id, data) => {
  const response = await fetch(`${BASE_URL}/devices/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update device');
  return response.json();
};

export const renewSubscription = async (data) => {
  const response = await fetch(`${BASE_URL}/subscriptions/renew`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to renew subscription');
  return response.json();
};

export const addPanelDays = async (subscriptionId, days) => {
  const response = await fetch(`${BASE_URL}/subscriptions/${subscriptionId}/add-panel-days`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to add panel days');
  return result;
};

// ===== AUTH =====
export const login = async (email, password) => {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Login failed');
  return result;
};

export const logoutApi = async (refreshToken) => {
  const response = await fetch(`${BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  return response.json();
};

export const getDashboardStats = async () => {
  const response = await fetch(`${BASE_URL}/dashboard/stats`);
  if (!response.ok) throw new Error('Failed to fetch dashboard stats');
  return response.json();
};

export const getTrialsByDate = async (date) => {
  const dateStr = date.toISOString().split('T')[0];
  const response = await fetch(`${BASE_URL}/dashboard/trials?date=${dateStr}`);
  if (!response.ok) throw new Error('Failed to fetch trials');
  return response.json();
};

export const getAllTrials = async () => {
  const response = await fetch(`${BASE_URL}/dashboard/trials?all=true`);
  if (!response.ok) throw new Error('Failed to fetch all trials');
  return response.json();
};

// ===== PAYMENTS =====
// params.month: optional 'YYYY-MM' to scope both the list and totalRevenue
// to that calendar month; omitted entirely preserves the original
// all-time-totals behavior.
export const getAllPayments = async (params = {}) => {
  const query = params.month ? `?month=${encodeURIComponent(params.month)}` : '';
  const response = await fetch(`${BASE_URL}/payments${query}`);
  if (!response.ok) throw new Error('Failed to fetch payments');
  return response.json();
};

export const createPayment = async (data) => {
  const response = await fetch(`${BASE_URL}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create payment');
  return response.json();
};

export const deletePayment = async (id) => {
  const response = await fetch(`${BASE_URL}/payments/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete payment');
  return response.json();
};

// ===== PUSH TOKENS =====
// These endpoints require the same staff Authorization header LoginScreen
// already stores in AsyncStorage on login — the first real use of that
// stored token for anything beyond auth/logout-all, not a new auth system.
//
// The access token is only valid for 15 minutes (see backend
// services/auth.service.js ACCESS_TOKEN_EXPIRY), but nothing was ever
// calling POST /auth/refresh with the also-stored refresh token — so any
// screen using this header (Notification Center, push-token screens) would
// start showing the raw "Not authorized, token is invalid or expired" error
// the moment a session ran past 15 minutes. authenticatedFetch below fixes
// this the standard way: on a 401, silently refresh once and retry: the
// caller never sees an expired-token error unless the refresh token itself
// is also dead (7 days — see REFRESH_TOKEN_EXPIRY_DAYS), which genuinely
// does require logging in again.
const refreshAccessToken = async () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  const refreshToken = await AsyncStorage.getItem('refreshToken');
  if (!refreshToken) return null;
  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return null;
    const result = await response.json();
    await AsyncStorage.setItem('accessToken', result.accessToken);
    return result.accessToken;
  } catch {
    return null;
  }
};

const authHeaders = async () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  const token = await AsyncStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Drop-in replacement for `fetch(url, options)` for every staff-authenticated
// endpoint below — attaches the current access token, and transparently
// refreshes + retries once on a 401 instead of surfacing it to the caller.
const authenticatedFetch = async (url, options = {}) => {
  const headers = { ...(options.headers || {}), ...(await authHeaders()) };
  let response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await fetch(url, {
        ...options,
        headers: { ...(options.headers || {}), Authorization: `Bearer ${newToken}` },
      });
    }
  }

  return response;
};

export const registerPushToken = async ({ customer, token, platform, previousToken }) => {
  const response = await authenticatedFetch(`${BASE_URL}/push-tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer, token, platform, previousToken }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to register push token');
  return result;
};

export const getPushTokensForCustomer = async (customerId) => {
  const response = await authenticatedFetch(`${BASE_URL}/push-tokens/customer/${customerId}`);
  if (!response.ok) throw new Error('Failed to fetch push tokens');
  return response.json();
};

export const invalidatePushToken = async (id) => {
  const response = await authenticatedFetch(`${BASE_URL}/push-tokens/${id}/invalidate`, { method: 'PATCH' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to invalidate push token');
  return result;
};

// ===== STAFF PUSH TOKENS =====
// Registers a device against the CALLING staff member's own identity — the
// backend derives staffId/staffType from the accessToken authenticatedFetch
// attaches, never from anything sent here. Separate collection/endpoint
// from the customer push-tokens above; see backend/models/StaffPushToken.js.
export const registerStaffPushToken = async ({ token, platform, previousToken }) => {
  const response = await authenticatedFetch(`${BASE_URL}/staff-push-tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform, previousToken }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to register staff push token');
  return result;
};

export const getMyStaffPushTokens = async () => {
  const response = await authenticatedFetch(`${BASE_URL}/staff-push-tokens/me`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to fetch staff push tokens');
  return result;
};

export const invalidateStaffPushToken = async (id) => {
  const response = await authenticatedFetch(`${BASE_URL}/staff-push-tokens/${id}/invalidate`, { method: 'PATCH' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to invalidate staff push token');
  return result;
};

// Explicit, admin-only real-device-test trigger — sends STAFF_PUSH to the
// calling admin's own registered devices only. Never called automatically.
export const triggerTestStaffPush = async () => {
  const response = await authenticatedFetch(`${BASE_URL}/notifications/admin/test-staff-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to trigger test staff push');
  return result;
};

// ===== STAFF/OWNER NOTIFICATION CENTER =====
export const getMyStaffNotifications = async (page = 1) => {
  const response = await authenticatedFetch(`${BASE_URL}/notifications/staff/me?page=${page}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to fetch notifications');
  return result;
};

export const getMyStaffUnreadCount = async () => {
  const response = await authenticatedFetch(`${BASE_URL}/notifications/staff/me/unread-count`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to fetch unread count');
  return result;
};

export const markAllStaffNotificationsRead = async () => {
  const response = await authenticatedFetch(`${BASE_URL}/notifications/staff/me/read-all`, { method: 'PATCH' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to mark notifications read');
  return result;
};

export const markStaffNotificationRead = async (id) => {
  const response = await authenticatedFetch(`${BASE_URL}/notifications/staff/me/${id}/read`, { method: 'PATCH' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to mark notification read');
  return result;
};
