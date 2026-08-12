// WEB_PUSH channel adapter — the Customer User App's browser push, via the
// standard Web Push protocol (Service Worker + Push API + VAPID). This is
// NOT the Owner/Staff Expo push path — completely separate adapter, reads
// the SAME PushToken collection (customer-scoped, platform:'web') but the
// stored `token` string is a JSON-serialized { endpoint, keys:{p256dh,auth} }
// subscription object, not an Expo token. Never touches StaffPushToken or
// the Expo client. Only active when an operator opts in via
// WEB_PUSH_ENABLED=true (see constants/notification.constants.js
// CONFIGURED_CHANNELS), independently of PUSH_NOTIFICATIONS_ENABLED /
// STAFF_PUSH_ENABLED.
const PushToken = require('../../models/PushToken');
const webpush = require('web-push');
const { FAILURE_TYPE } = require('../../constants/notification.constants');

let vapidConfigured = false;
const ensureVapidConfigured = () => {
  if (vapidConfigured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:support@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigured = true;
  return true;
};

// A stored token is only ever valid if it round-trips through JSON.parse
// into the {endpoint, keys:{p256dh, auth}} shape the web-push library
// requires — anything else (e.g. a stray Expo token string that somehow
// ended up on a platform:'web' row) is malformed for this channel.
const parseSubscription = (token) => {
  try {
    const parsed = JSON.parse(token);
    if (parsed && parsed.endpoint && parsed.keys && parsed.keys.p256dh && parsed.keys.auth) {
      return parsed;
    }
    return null;
  } catch (error) {
    return null;
  }
};

// web-push throws with a statusCode on send failure; 404/410 mean the
// browser/OS has permanently discarded this subscription (uninstalled,
// permission revoked, storage cleared) — never retryable.
const TERMINAL_STATUS_CODES = new Set([404, 410]);

const maskEndpoint = (endpoint) =>
  typeof endpoint === 'string' ? `${endpoint.slice(0, 40)}…${endpoint.slice(-8)}` : endpoint;

const send = async (notification) => {
  if (!ensureVapidConfigured()) {
    return {
      success: false,
      providerMessageId: null,
      providerResponse: null,
      failureType: FAILURE_TYPE.PERMANENT,
      failureReason: 'VAPID keys are not configured in this environment.',
    };
  }

  const tokens = await PushToken.find({ customer: notification.customer, platform: 'web', isActive: true });

  if (tokens.length === 0) {
    return {
      success: false,
      providerMessageId: null,
      providerResponse: null,
      failureType: FAILURE_TYPE.PERMANENT,
      failureReason: 'No active web push subscriptions registered for this customer.',
    };
  }

  const parsedByToken = tokens.map((t) => ({ tokenDoc: t, subscription: parseSubscription(t.token) }));
  const malformed = parsedByToken.filter((p) => !p.subscription);
  const valid = parsedByToken.filter((p) => p.subscription);

  if (malformed.length > 0) {
    await PushToken.updateMany({ _id: { $in: malformed.map((p) => p.tokenDoc._id) } }, { $set: { isActive: false } });
  }

  if (valid.length === 0) {
    return {
      success: false,
      providerMessageId: null,
      providerResponse: { deactivatedMalformedTokens: malformed.length },
      failureType: FAILURE_TYPE.PERMANENT,
      failureReason: 'No syntactically valid web push subscriptions registered for this customer.',
    };
  }

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    data: { notificationId: notification.notificationId, eventType: notification.eventType },
  });

  const results = await Promise.all(
    valid.map(async ({ tokenDoc, subscription }) => {
      try {
        await webpush.sendNotification(subscription, payload);
        return { tokenId: tokenDoc._id, endpoint: subscription.endpoint, success: true };
      } catch (error) {
        return {
          tokenId: tokenDoc._id,
          endpoint: subscription.endpoint,
          success: false,
          statusCode: error.statusCode,
          message: error.message,
        };
      }
    })
  );

  const terminallyFailedIds = results.filter((r) => !r.success && TERMINAL_STATUS_CODES.has(r.statusCode)).map((r) => r.tokenId);
  if (terminallyFailedIds.length > 0) {
    await PushToken.updateMany({ _id: { $in: terminallyFailedIds } }, { $set: { isActive: false } });
  }

  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  const providerResponse = {
    attempted: results.length,
    succeeded: succeeded.length,
    failed: failed.length,
    perSubscription: results.map((r) => ({
      endpoint: maskEndpoint(r.endpoint),
      status: r.success ? 'ok' : 'error',
      statusCode: r.statusCode || undefined,
    })),
  };

  if (succeeded.length > 0) {
    return {
      success: true,
      providerMessageId: null,
      providerResponse,
      failureType: null,
      failureReason: null,
    };
  }

  const allTerminal = failed.every((r) => TERMINAL_STATUS_CODES.has(r.statusCode));
  return {
    success: false,
    providerMessageId: null,
    providerResponse,
    failureType: allTerminal ? FAILURE_TYPE.PERMANENT : FAILURE_TYPE.TRANSIENT,
    failureReason: `All ${failed.length} subscription(s) failed: ${failed.map((r) => r.statusCode || r.message).join(', ')}`,
  };
};

module.exports = { send };
