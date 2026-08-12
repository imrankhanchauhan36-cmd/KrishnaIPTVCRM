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
  // Staff/Owner App device-registration verification only — never wired
  // into EVENT_DEFAULT_CHANNELS or any business flow in this phase. Raised
  // exclusively by the explicit POST /api/notifications/admin/test-staff-push
  // endpoint, always with an explicit channels:[STAFF_PUSH] override.
  STAFF_TEST_NOTIFICATION: 'STAFF_TEST_NOTIFICATION',
  // Customer User App phase — taxonomy only in this phase. No controller
  // raises these yet; the actual "send to all eligible customers" admin
  // mechanism is explicitly deferred to a later phase (per business
  // decision). Reserved here now so that later work is additive (new
  // trigger + template only) rather than a redesign of this taxonomy.
  ADMIN_BROADCAST: 'ADMIN_BROADCAST', // offers / general announcements
  SERVICE_MAINTENANCE: 'SERVICE_MAINTENANCE', // our IPTV service/server temporarily unavailable
  SERVICE_RESTORED: 'SERVICE_RESTORED', // our IPTV service/server back up
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
  // Targets StaffPushToken devices (Owner App's own Admin/Employee login),
  // never PushToken/Customer. Kept independently gated from PUSH — see
  // CONFIGURED_CHANNELS below.
  STAFF_PUSH: 'STAFF_PUSH',
  // Customer User App's browser Web Push subscriptions — stored in the
  // SAME PushToken collection as the Owner/Staff Expo tokens (customer-
  // scoped, platform:'web'), but dispatched via a completely separate
  // adapter (webPush.adapter.js) since the payload shape (VAPID-signed
  // {endpoint,keys}) is fundamentally different from an Expo push token
  // string. Never mixed with CHANNELS.PUSH.
  WEB_PUSH: 'WEB_PUSH',
});

// IN_APP always has a real, non-stub adapter. PUSH gains a real (Expo)
// adapter in this phase but is deliberately opt-in via an environment flag
// rather than always-on — mirrors the REMINDER_SCHEDULER_ENABLED precedent
// from Scheduler Safety Hardening: a new delivery capability must never
// activate itself just because the server started. Requires a restart to
// change, same as that flag. WHATSAPP/SMS/EMAIL remain stubs (no credentials
// exist for those providers).
// STAFF_PUSH has its own independent flag, STAFF_PUSH_ENABLED — deliberately
// separate from PUSH_NOTIFICATIONS_ENABLED so the (still-experimental,
// physical-device-test-only) staff channel can never be turned on as a side
// effect of enabling customer push, or vice versa. Both default off.
// WEB_PUSH has its own independent flag too, WEB_PUSH_ENABLED — same
// reasoning as STAFF_PUSH_ENABLED: the customer-facing web channel must
// never turn on as a side effect of enabling the Owner/Staff Expo channels.
const configuredChannels = [CHANNELS.IN_APP];
if (process.env.PUSH_NOTIFICATIONS_ENABLED === 'true') configuredChannels.push(CHANNELS.PUSH);
if (process.env.STAFF_PUSH_ENABLED === 'true') configuredChannels.push(CHANNELS.STAFF_PUSH);
if (process.env.WEB_PUSH_ENABLED === 'true') configuredChannels.push(CHANNELS.WEB_PUSH);
const CONFIGURED_CHANNELS = Object.freeze(configuredChannels);

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
  [EVENT_TYPES.STAFF_TEST_NOTIFICATION]: NOTIFICATION_CATEGORY.TRANSACTIONAL,
  // Offers respect the customer's promotional opt-out; maintenance/restore
  // notices are important service information and always go out, same as
  // every other TRANSACTIONAL event.
  [EVENT_TYPES.ADMIN_BROADCAST]: NOTIFICATION_CATEGORY.PROMOTIONAL,
  [EVENT_TYPES.SERVICE_MAINTENANCE]: NOTIFICATION_CATEGORY.TRANSACTIONAL,
  [EVENT_TYPES.SERVICE_RESTORED]: NOTIFICATION_CATEGORY.TRANSACTIONAL,
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
  [EVENT_TYPES.STAFF_TEST_NOTIFICATION]: PRIORITY.LOW,
  [EVENT_TYPES.ADMIN_BROADCAST]: PRIORITY.NORMAL,
  [EVENT_TYPES.SERVICE_MAINTENANCE]: PRIORITY.HIGH,
  [EVENT_TYPES.SERVICE_RESTORED]: PRIORITY.HIGH,
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
// even before every provider is wired up. PUSH is added to every event here
// (Push Notification phase) — whether it actually attempts delivery still
// depends entirely on CONFIGURED_CHANNELS (env-gated) and on the customer
// having at least one active PushToken; adding it to this list changes no
// existing IN_APP/WHATSAPP behavior for any event.
//
// STAFF_TEST_NOTIFICATION has NO entry here, deliberately — it is never
// raised through a default-channel lookup. Its only caller (the admin
// test-staff-push endpoint) always passes an explicit
// channels:[CHANNELS.STAFF_PUSH] override to raiseEvent, so
// EVENT_DEFAULT_CHANNELS[eventType] is never consulted for it. Do not add
// an entry here until STAFF_PUSH is deliberately connected to a real
// business event.
//
// WEB_PUSH is added alongside PUSH on every customer-facing event below
// (Customer User App phase) — same reasoning as when PUSH itself was added:
// whether it actually attempts delivery still depends entirely on
// CONFIGURED_CHANNELS (WEB_PUSH_ENABLED) and on the customer having at
// least one active platform:'web' PushToken. No existing IN_APP/WHATSAPP/
// PUSH behavior changes for any event. ADMIN_BROADCAST/SERVICE_MAINTENANCE/
// SERVICE_RESTORED intentionally have NO entry here — there is no trigger
// for them yet (deferred to a later phase); adding an entry with nothing
// that ever calls raiseEvent for these event types would be dead config.
const EVENT_DEFAULT_CHANNELS = Object.freeze({
  [EVENT_TYPES.CUSTOMER_CREATED]: [CHANNELS.IN_APP, CHANNELS.WHATSAPP, CHANNELS.PUSH, CHANNELS.WEB_PUSH],
  [EVENT_TYPES.SUBSCRIPTION_CREATED]: [CHANNELS.IN_APP, CHANNELS.WHATSAPP, CHANNELS.PUSH, CHANNELS.WEB_PUSH],
  [EVENT_TYPES.SUBSCRIPTION_RENEWED]: [CHANNELS.IN_APP, CHANNELS.WHATSAPP, CHANNELS.PUSH, CHANNELS.WEB_PUSH],
  [EVENT_TYPES.SUBSCRIPTION_EXPIRING]: [CHANNELS.IN_APP, CHANNELS.WHATSAPP, CHANNELS.PUSH, CHANNELS.WEB_PUSH],
  [EVENT_TYPES.SUBSCRIPTION_EXPIRED]: [CHANNELS.IN_APP, CHANNELS.WHATSAPP, CHANNELS.PUSH, CHANNELS.WEB_PUSH],
  [EVENT_TYPES.PAYMENT_SUCCESS]: [CHANNELS.IN_APP, CHANNELS.WHATSAPP, CHANNELS.PUSH, CHANNELS.WEB_PUSH],
  [EVENT_TYPES.PAYMENT_FAILED]: [CHANNELS.IN_APP, CHANNELS.WHATSAPP, CHANNELS.PUSH, CHANNELS.WEB_PUSH],
  [EVENT_TYPES.DEVICE_ASSIGNED]: [CHANNELS.IN_APP, CHANNELS.PUSH, CHANNELS.WEB_PUSH],
  [EVENT_TYPES.DEVICE_CHANGED]: [CHANNELS.IN_APP, CHANNELS.PUSH, CHANNELS.WEB_PUSH],
  [EVENT_TYPES.DEVICE_UNASSIGNED]: [CHANNELS.IN_APP, CHANNELS.PUSH, CHANNELS.WEB_PUSH],
  [EVENT_TYPES.RENEWAL_REMINDER]: [CHANNELS.IN_APP, CHANNELS.WHATSAPP, CHANNELS.PUSH, CHANNELS.WEB_PUSH],
  [EVENT_TYPES.PAYMENT_REMINDER]: [CHANNELS.IN_APP, CHANNELS.WHATSAPP, CHANNELS.PUSH, CHANNELS.WEB_PUSH],
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
