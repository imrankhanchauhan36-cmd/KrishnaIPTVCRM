const Notification = require('../models/Notification');
const NotificationDelivery = require('../models/NotificationDelivery');
const NotificationPreference = require('../models/NotificationPreference');
const Counter = require('../models/Counter');
const { renderTemplate } = require('../templates/notification.templates');
const { dispatchToChannel, isChannelConfigured } = require('./notificationChannels');
const {
  EVENT_TYPES,
  EVENT_CATEGORY,
  EVENT_PRIORITY,
  EVENT_DEFAULT_CHANNELS,
  NOTIFICATION_STATUS,
  NOTIFICATION_CATEGORY,
  DELIVERY_ATTEMPT_STATUS,
  FAILURE_TYPE,
  RETRY_BACKOFF_MINUTES,
  MAX_RETRIES,
} = require('../constants/notification.constants');

// Structured, low-noise logging — matches this project's existing
// console.log/console.error convention (no winston/pino anywhere in the
// codebase). Never logs template bodies or provider secrets, only IDs/enums.
const log = (event, fields = {}) => {
  console.log(`[Notification] ${event}`, JSON.stringify(fields));
};

const generateNotificationId = async () => {
  const counter = await Counter.findOneAndUpdate(
    { name: 'notificationId' },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );
  return `NOTIF${String(counter.value).padStart(6, '0')}`;
};

// Deterministic per (event, entity, channel[, extra]) key. `entityId` is
// whatever uniquely identifies the underlying occurrence for this event —
// a subscriptionId, paymentId, deviceId, or the customerId itself for
// customer-level one-time events. `extra` further qualifies repeatable
// events (e.g. a reminder stage) so D-7 and D-1 for the same subscription
// never collide. This is the single implementation every caller goes
// through — never build this string ad hoc anywhere else.
const buildIdempotencyKey = ({ eventType, entityId, channel, extra }) =>
  `${eventType}:${entityId}${extra ? ':' + extra : ''}:${channel}`;

const PREFERENCE_CHANNEL_FIELD = {
  IN_APP: 'inApp',
  PUSH: 'push',
  WHATSAPP: 'whatsapp',
  SMS: 'sms',
  EMAIL: 'email',
};

// Returns { allowed, reason } — never throws, defaults to allowed when no
// preference document exists yet (opt-out model, not opt-in).
const checkPreference = async (customerId, channel, category) => {
  const pref = await NotificationPreference.findOne({ customer: customerId }).lean();
  if (!pref) return { allowed: true, reason: null };

  const channelField = PREFERENCE_CHANNEL_FIELD[channel];
  if (channelField && pref.channels && pref.channels[channelField] === false) {
    return { allowed: false, reason: `Customer has disabled the ${channel} channel.` };
  }

  if (category === NOTIFICATION_CATEGORY.REMINDER && pref.categories && pref.categories.reminder === false) {
    return { allowed: false, reason: 'Customer has disabled reminder notifications.' };
  }
  if (category === NOTIFICATION_CATEGORY.PROMOTIONAL && pref.categories && pref.categories.promotional === false) {
    return { allowed: false, reason: 'Customer has disabled promotional notifications.' };
  }
  // TRANSACTIONAL is never category-gated — only the channel switch above applies.
  return { allowed: true, reason: null };
};

// Attempts delivery for one already-created, still-PENDING Notification.
// Records a NotificationDelivery row for every attempt (never overwritten),
// and never throws — a channel/provider failure must never propagate to
// the caller of raiseEvent, and must never bubble out of the retry sweep.
const attemptDelivery = async (notificationId) => {
  const notification = await Notification.findById(notificationId);
  if (!notification || notification.status !== NOTIFICATION_STATUS.PENDING) {
    return; // already terminal, already delivered, or deleted — nothing to do
  }

  const attemptNumber = notification.retryCount + 1;
  let result;
  try {
    result = await dispatchToChannel(notification.channel, notification);
  } catch (error) {
    result = {
      success: false,
      providerMessageId: null,
      providerResponse: null,
      failureType: FAILURE_TYPE.TRANSIENT,
      failureReason: `Unexpected dispatch error: ${error.message}`,
    };
  }

  await NotificationDelivery.create({
    notification: notification._id,
    channel: notification.channel,
    attemptNumber,
    status: result.success ? DELIVERY_ATTEMPT_STATUS.SUCCESS : DELIVERY_ATTEMPT_STATUS.FAILED,
    providerMessageId: result.providerMessageId || undefined,
    providerResponse: result.providerResponse || undefined,
    failureType: result.success ? undefined : result.failureType,
    failureReason: result.success ? undefined : result.failureReason,
  });

  if (result.success) {
    notification.status = NOTIFICATION_STATUS.SENT;
    notification.sentAt = new Date();
    notification.providerMessageId = result.providerMessageId || undefined;
    if (notification.channel === 'IN_APP') {
      // Persisting IS delivering for IN_APP — there is no separate
      // "in transit" state for a channel with no external hop.
      notification.status = NOTIFICATION_STATUS.DELIVERED;
      notification.deliveredAt = new Date();
    }
    await notification.save();
    log('delivery succeeded', { notificationId: notification.notificationId, channel: notification.channel, attemptNumber });
    return;
  }

  const isPermanent = result.failureType === FAILURE_TYPE.PERMANENT;
  const retriesExhausted = attemptNumber >= MAX_RETRIES;

  if (isPermanent || retriesExhausted) {
    notification.status = NOTIFICATION_STATUS.FAILED;
    notification.failedAt = new Date();
    notification.failureReason = result.failureReason;
    notification.retryCount = attemptNumber;
    await notification.save();
    log('permanently failed', {
      notificationId: notification.notificationId,
      channel: notification.channel,
      attemptNumber,
      reason: result.failureReason,
    });
    return;
  }

  notification.retryCount = attemptNumber;
  const backoffMinutes = RETRY_BACKOFF_MINUTES[attemptNumber - 1];
  notification.nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
  notification.failureReason = result.failureReason;
  await notification.save();
  log('retry scheduled', {
    notificationId: notification.notificationId,
    channel: notification.channel,
    attemptNumber,
    nextRetryAt: notification.nextRetryAt,
  });
};

// The single entry point every business controller calls. Fire-and-forget
// by design: creation is awaited (so tests/callers can inspect what was
// created), but actual channel delivery is dispatched via setImmediate so
// it never adds latency to — or can ever fail — the caller's own request.
// A thrown error here must be caught by the caller; raiseEvent itself never
// throws for delivery-side reasons, only for programmer errors (unknown
// event type, missing customer).
const raiseEvent = async ({ eventType, customer, subscription, entityId, extra, channels, variables = {}, metadata = {} }) => {
  if (!Object.values(EVENT_TYPES).includes(eventType)) {
    throw new Error(`Unknown notification event type "${eventType}"`);
  }
  if (!customer) {
    throw new Error('raiseEvent requires a customer id');
  }

  const category = EVENT_CATEGORY[eventType] || NOTIFICATION_CATEGORY.TRANSACTIONAL;
  const priority = EVENT_PRIORITY[eventType] || 'NORMAL';
  const resolvedChannels = channels || EVENT_DEFAULT_CHANNELS[eventType] || [];
  const resolvedEntityId = entityId || String(customer);

  const created = [];

  for (const channel of resolvedChannels) {
    const idempotencyKey = buildIdempotencyKey({ eventType, entityId: resolvedEntityId, channel, extra });

    // Idempotency, application-level check first (cheap, avoids a template
    // render + Counter increment for the common "already exists" case).
    const existing = await Notification.findOne({ idempotencyKey });
    if (existing) {
      log('duplicate event ignored', { idempotencyKey, notificationId: existing.notificationId });
      created.push(existing);
      continue;
    }

    const { allowed, reason: blockedReason } = await checkPreference(customer, channel, category);
    const channelConfigured = isChannelConfigured(channel);

    const { templateId, title, body } = renderTemplate(eventType, variables);
    const notificationId = await generateNotificationId();

    let status = NOTIFICATION_STATUS.PENDING;
    let skipReason = null;
    if (!allowed) {
      status = NOTIFICATION_STATUS.SKIPPED;
      skipReason = blockedReason;
    } else if (!channelConfigured) {
      status = NOTIFICATION_STATUS.SKIPPED;
      skipReason = `${channel} has no configured provider in this environment.`;
    }

    let doc;
    try {
      doc = await Notification.create({
        notificationId,
        eventType,
        notificationCategory: category,
        customer,
        subscription: subscription || undefined,
        title,
        body,
        templateId,
        channel,
        priority,
        status,
        failureReason: skipReason || undefined,
        idempotencyKey,
        metadata,
      });
    } catch (error) {
      // Duplicate-key race: another concurrent call created the same
      // idempotencyKey between our findOne check and this insert. The
      // unique index (not this catch block) is the real guarantee — this
      // just resolves the race gracefully instead of surfacing a 500.
      if (error.code === 11000) {
        const winner = await Notification.findOne({ idempotencyKey });
        log('duplicate event ignored (race)', { idempotencyKey, notificationId: winner?.notificationId });
        created.push(winner);
        continue;
      }
      throw error;
    }

    log('notification created', { notificationId: doc.notificationId, eventType, channel, status });
    created.push(doc);

    if (status === NOTIFICATION_STATUS.PENDING) {
      log('notification queued', { notificationId: doc.notificationId, channel });
      setImmediate(() => {
        attemptDelivery(doc._id).catch((error) => {
          console.error(`[Notification] attemptDelivery crashed for ${doc.notificationId}:`, error.message);
        });
      });
    } else {
      log('notification skipped', { notificationId: doc.notificationId, channel, reason: skipReason });
    }
  }

  return created;
};

// Called by the scheduler sweep (jobs/renewalCheck.job.js). Picks up any
// PENDING notification whose retry (or initial attempt) is due — this is
// what makes retries survive a server restart or a missed setImmediate,
// without ever double-sending (attemptDelivery re-checks status===PENDING
// and the idempotency key already prevented duplicate rows from existing).
const runRetrySweep = async () => {
  const now = new Date();
  const due = await Notification.find({
    status: NOTIFICATION_STATUS.PENDING,
    $or: [{ nextRetryAt: { $lte: now } }, { nextRetryAt: null, scheduledAt: { $lte: now } }],
  }).select('_id notificationId');

  for (const n of due) {
    await attemptDelivery(n._id);
  }
  return due.length;
};

// The integration-safe entry point every business controller should
// actually call. Identical to raiseEvent except it NEVER throws — a bug in
// the notification layer (unknown event type, template error, DB hiccup on
// the Notification write itself) must never roll back or fail the
// underlying business operation (customer/subscription/payment/device
// change) that already succeeded. Logs and swallows instead.
const safeRaiseEvent = async (params) => {
  try {
    return await raiseEvent(params);
  } catch (error) {
    console.error(`[Notification] raiseEvent failed for ${params.eventType}:`, error.message);
    return [];
  }
};

module.exports = {
  raiseEvent,
  safeRaiseEvent,
  attemptDelivery,
  runRetrySweep,
  buildIdempotencyKey,
  checkPreference,
  generateNotificationId,
};
