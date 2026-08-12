// Shapes mirror the backend Mongoose documents exactly (field names match
// Customer.js / Subscription.js / Notification.js) — no renaming, no
// inventing fields that don't already exist server-side.

export interface Customer {
  _id: string;
  customerId: string;
  fullName: string;
  email?: string;
  whatsappNumber: string;
  status: 'Active' | 'Expired' | 'Inactive';
}

// Deliberately excludes panelExpiryDate/panelAddedDays — those are internal
// panel-operations fields (see backend/controllers/customerAuth.controller.js
// toCustomerSafeSubscription) that the API never sends to a customer
// session, so they must never appear in this type either. renewalDate is
// the customer's actual paid-for service boundary ("Starting Date + Plan
// Duration, fixed, never affected by panel days") — that is the field
// "Valid Until" is built from.
export interface Subscription {
  _id: string;
  plan: string;
  priceUSD: number;
  startingDate: string;
  renewalDate: string;
  status: 'Active' | 'Expired';
  createdAt: string;
  device?: string;
}

export interface Device {
  _id: string;
  deviceName?: string;
  deviceType: string;
  macAddress: string;
  status: 'Active' | 'Inactive';
}

export interface MeResponse {
  customer: Customer;
  subscriptions: Subscription[];
  devices: Device[];
}

export interface NotificationItem {
  _id: string;
  title: string;
  body: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'SKIPPED';
  channel: string;
  readAt: string | null;
  createdAt: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  customer: Customer;
}
