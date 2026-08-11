// Frozen Notification Engine taxonomy. Every event/channel/status/priority
// string used anywhere in the notification stack must come from here —
// no free-text event names, ever.

// Business events the rest of the app is allowed to raise. Adding a new
// event type means adding it here first, then wiring a template + trigger
// for it — never inventing an ad-hoc string at the call site.
const EVENT_TYPES = Object.freeze({
  CUSTOMER_CREATED: 'CUSTOMER_CREATED',
  SUBSCRIPTION_CREATED: 'SUBSCRIPTION_CREATED',
  SUBSCRIPTION_RENEWED: 'SUBSCRIPTION_RENEWED',
  SUBSCRIPTION_EXPIRING: 'SUBSCRIPTION_EXPIRING',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  DEVICE_ASSIGNED: 'DEVICE_ASSIGNED',
  DEVICE_CHANGED: 'DEVICE_CHANGED',
  DEVICE_UNASSIGNED: 'DEVICE_UNASSIGNED',
  RENEWAL_REMINDER: 'RENEWAL_REMINDER',
  PAYMENT_REMINDER: 'PAYMENT_REMINDER',
});

// Reserved event types with no live trigger in V1 (documented, not faked):
//   PAYMENT_FAILED   — this CRM only ever records a payment after the money
//                       has already been received manually; there is no
//                       payment gateway, so nothing can currently observe a
//                       failed payment. The constant/template/engine path
//                       exists so a future gateway integration can raise it
//                       without any Notification Engine changes.
//   RENEWAL_REMINDER,
//   PAYMENT_REMINDER — reserved for a future manual/admin-triggered "send a
//                       reminder now" action. The automatic scheduler in V1
//                       raises the more specific SUBSCRIPTION_EXPIRING /
//                       SUBSCRIPTION_EXPIRED instead (see jobs/renewalCheck.job.js).

const CHANNELS = Object.freeze({
  IN_APP: 'IN_APP',
  PUSH: 'PUSH',
  WHATSAPP: 'WHATSAPP',
  SMS: 'SMS',
  EMAIL: 'EMAIL',
});

// Only IN_APP has a real, non-stub adapter in V1 (see services/notificationChannels).
const CONFIGURED_CHANNELS = Object.freeze([CHANNELS.IN_APP]);

const NOTIFICATION_STATUS = Object.freeze({
  PENDING: 'PENDING', // created, not yet dispatched (or awaiting a scheduled retry)
  SENT: 'SENT', // adapter reported success
  DELIVERED: 'DELIVERED', // channel confirmed delivery (beyond just "sent")
  READ: 'READ', // recipient has read it (IN_APP today; other channels later)
  FAILED: 'FAILED', // permanently failed — retries exhausted or non-retryable
  SKIPPED: 'SKIPPED', // never attempted — blocked by preference or unconfigured channel
});

const NOTIFICATION_CATEGORY = Object.freeze({
  TRANSACTIONAL: 'TRANSACTIONAL', // always sent regardless of category preference
  REMINDER: 'REMINDER', // respects the customer's reminder preference
  PROMOTIONAL: 'PROMOTIONAL', // respects the customer's promotional preference; none wired in V1
});

const EVENT_CATEGORY = Object.freeze({
  [EVENT_TYPES.CUSTOMER_CREATED]: NOTIFICATION_CATEGORY.TRANSACTIONAL,
  [EVENT_TYPES.SUBSCRIPTION_CREATED]: NOTIFICATION_CATEGORY.TRANSACTIONAL,
  [EVENT_TYPES.SUBSCRIPTION_RENEWED]: NOTIFICATION_CATEGORY.TRANSACTIONAL,
  [EVENT_TYPES.PAYMENT_SUCCESS]: NOTIFICATION_CATEGORY.TRANSACTIONAL,
  [EVENT_TYPES.PAYMENT_FAILED]: NOTIFICATION_CATEGORY.TRANSACTIONAL,
  [EVENT_TYPES.DEVICE_ASSIGNED]: NOTIFICATION_CATEGORY.TRANSACTIONAL,
  [EVENT_TYPES.DEVICE_CHANGED]: NOTIFICATION_CATEGORY.TRANSACTIONAL,
  [EVENT_TYPES.DEVICE_UNASSIGNED]: NOTIFICATION_CATEGORY.TRANSACTIONAL,
  [EVENT_TYPES.SUBSCRIPTION_EXPIRING]: NOTIFICATION_CATEGORY.REMINDER,
  [EVENT_TYPES.SUBSCRIPTION_EXPIRED]: NOTIFICATION_CATEGORY.REMINDER,
  [EVENT_TYPES.RENEWAL_REMINDER]: NOTIFICATION_CATEGORY.REMINDER,
  [EVENT_TYPES.PAYMENT_REMINDER]: NOTIFICATION_CATEGORY.REMINDER,
});

const PRIORITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  NORMAL: 'NORMAL',
  LOW: 'LOW',
});

// Lower number = more urgent. Used only for ordering, never persisted.
const PRIORITY_WEIGHT = Object.freeze({
  [PRIORITY.CRITICAL]: 0,
  [PRIORITY.HIGH]: 1,
  [PRIORITY.NORMAL]: 2,
  [PRIORITY.LOW]: 3,
});

const EVENT_PRIORITY = Object.freeze({
  [EVENT_TYPES.PAYMENT_FAILED]: PRIORITY.HIGH,
  [EVENT_TYPES.SUBSCRIPTION_EXPIRED]: PRIORITY.HIGH,
  [EVENT_TYPES.SUBSCRIPTION_EXPIRING]: PRIORITY.NORMAL,
  [EVENT_TYPES.CUSTOMER_CREATED]: PRIORITY.NORMAL,
  [EVENT_TYPES.SUBSCRIPTION_CREATED]: PRIORITY.NORMAL,
  [EVENT_TYPES.SUBSCRIPTION_RENEWED]: PRIORITY.NORMAL,
  [EVENT_TYPES.PAYMENT_SUCCESS]: PRIORITY.NORMAL,
  [EVENT_TYPES.DEVICE_ASSIGNED]: PRIORITY.NORMAL,
  [EVENT_TYPES.DEVICE_CHANGED]: PRIORITY.NORMAL,
  [EVENT_TYPES.DEVICE_UNASSIGNED]: PRIORITY.NORMAL,
  [EVENT_TYPES.RENEWAL_REMINDER]: PRIORITY.NORMAL,
  [EVENT_TYPES.PAYMENT_REMINDER]: PRIORITY.NORMAL,
});

// Per-attempt outcome, recorded on NotificationDelivery — distinct from the
// roll-up NOTIFICATION_STATUS on the Notification document itself.
const DELIVERY_ATTEMPT_STATUS = Object.freeze({
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
});

const FAILURE_TYPE = Object.freeze({
  TRANSIENT: 'TRANSIENT', // network timeout, provider 5xx, rate limit — retry
  PERMANENT: 'PERMANENT', // invalid recipient/template/credentials — never retry
});

// Minutes to wait before each retry attempt (index 0 = delay before the 1st
// retry). Length of this array is the max retry count.
const RETRY_BACKOFF_MINUTES = Object.freeze([1, 5, 30]);
const MAX_RETRIES = RETRY_BACKOFF_MINUTES.length;

// The CRM is India-first; every reminder day-boundary calculation must use
// this single, centrally defined timezone rather than the server process's
// OS default (which happens to already be IST, but that's implicit and
// fragile — this constant makes it explicit and greppable).
const BUSINESS_TIMEZONE = 'Asia/Kolkata';

// Reminder stages the scheduler recognizes, stored in Notification.metadata
// so each stage is independently idempotent (D-7 firing doesn't block D-1).
const REMINDER_STAGE = Object.freeze({
  D7: 'D-7',
  D3: 'D-3',
  D1: 'D-1',
  D_DAY: 'D-DAY',
  EXPIRED: 'EXPIRED',
});

// Offsets (days before renewalDate) the scheduler checks for
// SUBSCRIPTION_EXPIRING, in order. D_DAY (offset 0) and EXPIRED (handled
// separately, once, the first time a subscription is found overdue) round
// out the full D-7..Expired lifecycle from the spec.
const REMINDER_OFFSETS_DAYS = Object.freeze([
  { stage: REMINDER_STAGE.D7, offsetDays: 7 },
  { stage: REMINDER_STAGE.D3, offsetDays: 3 },
  { stage: REMINDER_STAGE.D1, offsetDays: 1 },
  { stage: REMINDER_STAGE.D_DAY, offsetDays: 0 },
]);

// The channel set the engine attempts for each event type, independent of
// whether those channels are actually configured (CONFIGURED_CHANNELS) —
// unconfigured attempts become SKIPPED, not silently omitted, so the
// intended architecture (multi-channel per event) is visible end-to-end
// even before every provider is wired up.
const EVENT_DEFAULT_CHANNELS = Object.freeze({
  [EVENT_TYPES.CUSTOMER_CREATED]: [CHANNELS.IN_APP, CHANNELS.WHATSAPP],
  [EVENT_TYPES.SUBSCRIPTION_CREATED]: [CHANNELS.IN_APP, CHANNELS.WHATSAPP],
  [EVENT_TYPES.SUBSCRIPTION_RENEWED]: [CHANNELS.IN_APP, CHANNELS.WHATSAPP],
  [EVENT_TYPES.SUBSCRIPTION_EXPIRING]: [CHANNELS.IN_APP, CHANNELS.WHATSAPP],
  [EVENT_TYPES.SUBSCRIPTION_EXPIRED]: [CHANNELS.IN_APP, CHANNELS.WHATSAPP],
  [EVENT_TYPES.PAYMENT_SUCCESS]: [CHANNELS.IN_APP, CHANNELS.WHATSAPP],
  [EVENT_TYPES.PAYMENT_FAILED]: [CHANNELS.IN_APP, CHANNELS.WHATSAPP],
  [EVENT_TYPES.DEVICE_ASSIGNED]: [CHANNELS.IN_APP],
  [EVENT_TYPES.DEVICE_CHANGED]: [CHANNELS.IN_APP],
  [EVENT_TYPES.DEVICE_UNASSIGNED]: [CHANNELS.IN_APP],
  [EVENT_TYPES.RENEWAL_REMINDER]: [CHANNELS.IN_APP, CHANNELS.WHATSAPP],
  [EVENT_TYPES.PAYMENT_REMINDER]: [CHANNELS.IN_APP, CHANNELS.WHATSAPP],
});

module.exports = {
  EVENT_TYPES,
  CHANNELS,
  CONFIGURED_CHANNELS,
  EVENT_DEFAULT_CHANNELS,
  NOTIFICATION_STATUS,
  NOTIFICATION_CATEGORY,
  EVENT_CATEGORY,
  PRIORITY,
  PRIORITY_WEIGHT,
  EVENT_PRIORITY,
  DELIVERY_ATTEMPT_STATUS,
  FAILURE_TYPE,
  RETRY_BACKOFF_MINUTES,
  MAX_RETRIES,
  BUSINESS_TIMEZONE,
  REMINDER_STAGE,
  REMINDER_OFFSETS_DAYS,
};
