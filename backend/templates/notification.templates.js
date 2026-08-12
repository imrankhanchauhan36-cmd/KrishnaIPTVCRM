const { EVENT_TYPES } = require('../constants/notification.constants');

// Centrally managed, versionable notification copy. Every template supports
// {{variableName}} substitution — see render() below. Templates must never
// reference raw internal IDs (_id, ObjectIds); only human-readable values
// (customerName, subscriptionPlan, renewalDate, deviceName, macAddress,
// amount, panelAddedDays, expiryDate) are ever passed in as variables.
const TEMPLATES = Object.freeze({
  [EVENT_TYPES.CUSTOMER_CREATED]: {
    templateId: 'customer_created_v1',
    version: 1,
    title: 'Welcome to Krishna IPTV!',
    body: 'Hello {{customerName}}, your account has been created successfully.',
  },
  [EVENT_TYPES.SUBSCRIPTION_CREATED]: {
    templateId: 'subscription_created_v1',
    version: 1,
    title: 'Subscription Activated',
    body: 'Hello {{customerName}}, your {{subscriptionPlan}} subscription is now active. Renewal due on {{renewalDate}}.',
  },
  [EVENT_TYPES.SUBSCRIPTION_RENEWED]: {
    templateId: 'subscription_renewed_v1',
    version: 1,
    title: 'Subscription Renewal Successful',
    body: 'Hello {{customerName}}, your {{subscriptionPlan}} subscription has been renewed successfully. Next renewal: {{renewalDate}}.',
  },
  [EVENT_TYPES.SUBSCRIPTION_EXPIRING]: {
    templateId: 'subscription_expiring_v1',
    version: 1,
    title: 'Your Subscription is Expiring Soon',
    body: 'Hello {{customerName}}, your {{subscriptionPlan}} subscription expires on {{expiryDate}}. Please renew to avoid interruption.',
  },
  [EVENT_TYPES.SUBSCRIPTION_EXPIRED]: {
    templateId: 'subscription_expired_v1',
    version: 1,
    title: 'Your Subscription Has Expired',
    body: 'Hello {{customerName}}, your {{subscriptionPlan}} subscription expired on {{expiryDate}}. Renew now to restore service.',
  },
  [EVENT_TYPES.PAYMENT_SUCCESS]: {
    templateId: 'payment_success_v1',
    version: 1,
    title: 'Payment Received',
    body: 'Hello {{customerName}}, we have received your payment of {{amount}}. Thank you!',
  },
  [EVENT_TYPES.PAYMENT_FAILED]: {
    templateId: 'payment_failed_v1',
    version: 1,
    title: 'Payment Failed',
    body: 'Hello {{customerName}}, your payment of {{amount}} could not be processed. Please try again.',
  },
  [EVENT_TYPES.DEVICE_ASSIGNED]: {
    templateId: 'device_assigned_v1',
    version: 1,
    title: 'Device Linked to Your Subscription',
    body: 'Hello {{customerName}}, device {{deviceName}} ({{macAddress}}) has been linked to your {{subscriptionPlan}} subscription.',
  },
  [EVENT_TYPES.DEVICE_CHANGED]: {
    templateId: 'device_changed_v1',
    version: 1,
    title: 'Device Details Updated',
    body: 'Hello {{customerName}}, your device details have been updated to {{deviceName}} ({{macAddress}}).',
  },
  [EVENT_TYPES.DEVICE_UNASSIGNED]: {
    templateId: 'device_unassigned_v1',
    version: 1,
    title: 'Device Unlinked',
    body: 'Hello {{customerName}}, a device has been unlinked from your {{subscriptionPlan}} subscription. Please contact support if you did not request this.',
  },
  [EVENT_TYPES.RENEWAL_REMINDER]: {
    templateId: 'renewal_reminder_v1',
    version: 1,
    title: 'Renewal Reminder',
    body: 'Hello {{customerName}}, this is a reminder that your {{subscriptionPlan}} subscription is due for renewal on {{renewalDate}}.',
  },
  [EVENT_TYPES.PAYMENT_REMINDER]: {
    templateId: 'payment_reminder_v1',
    version: 1,
    title: 'Payment Reminder',
    body: 'Hello {{customerName}}, this is a reminder that a payment of {{amount}} is due for your {{subscriptionPlan}} subscription.',
  },
  [EVENT_TYPES.STAFF_TEST_NOTIFICATION]: {
    templateId: 'staff_test_notification_v1',
    version: 1,
    title: 'Test Push Notification',
    body: 'This is a test push notification from Krishna IPTV CRM. If you can see this, staff push delivery is working.',
  },
  // No live trigger yet (see EVENT_DEFAULT_CHANNELS comment) — templates
  // exist now so a later admin-broadcast endpoint only needs to add the
  // trigger itself, not design the copy. {{title}}/{{message}} are meant
  // to be supplied per-broadcast by the admin, not fixed copy.
  [EVENT_TYPES.ADMIN_BROADCAST]: {
    templateId: 'admin_broadcast_v1',
    version: 1,
    title: '{{title}}',
    body: '{{message}}',
  },
  [EVENT_TYPES.SERVICE_MAINTENANCE]: {
    templateId: 'service_maintenance_v1',
    version: 1,
    title: '⚠️ Service Maintenance',
    body: 'Our service is temporarily unavailable due to maintenance. Service will resume shortly.',
  },
  [EVENT_TYPES.SERVICE_RESTORED]: {
    templateId: 'service_restored_v1',
    version: 1,
    title: '✅ Service Restored',
    body: 'Our service is back up and running normally. Thank you for your patience.',
  },
});

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

// Substitutes {{variableName}} tokens. Any variable not present in `vars`
// renders as an empty string rather than leaking the raw token or throwing —
// callers are responsible for only ever passing safe, human-readable values.
const renderString = (str, vars) =>
  str.replace(VARIABLE_PATTERN, (_match, key) => (vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : ''));

const getTemplate = (eventType) => {
  const template = TEMPLATES[eventType];
  if (!template) {
    throw new Error(`No notification template registered for event type "${eventType}"`);
  }
  return template;
};

// Renders a template into a plain { templateId, title, body } object —
// channel adapters decide how to further format/truncate this per channel.
const renderTemplate = (eventType, vars = {}) => {
  const template = getTemplate(eventType);
  return {
    templateId: template.templateId,
    title: renderString(template.title, vars),
    body: renderString(template.body, vars),
  };
};

module.exports = { TEMPLATES, getTemplate, renderTemplate };
