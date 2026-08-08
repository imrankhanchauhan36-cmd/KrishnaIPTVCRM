import Constants from 'expo-constants';

// ⚙️ SWITCH THIS to control which backend the app talks to:
// true  = Render (production, live 24/7, works anywhere)
// false = Local Mac backend (only works when your Mac is running the server on the same WiFi)
const USE_PRODUCTION = false;

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
export const getAllPayments = async () => {
  const response = await fetch(`${BASE_URL}/payments`);
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
