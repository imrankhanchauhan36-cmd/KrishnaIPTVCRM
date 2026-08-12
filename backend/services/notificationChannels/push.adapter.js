// PUSH channel adapter — real implementation using Expo's push relay (see
// expoPushClient.js). No FCM/APNs credentials are needed or read; Expo's
// service works directly off a valid Expo push token. Only active when an
// operator has explicitly opted in via PUSH_NOTIFICATIONS_ENABLED=true (see
// constants/notification.constants.js CONFIGURED_CHANNELS) — until then
// this file's send() is never invoked at all, matching every other
// unconfigured channel's behavior.
//
// One Notification (and therefore one attemptDelivery/send() call) always
// maps to exactly one customer, never one device — multi-device fan-out
// happens ENTIRELY inside this function. A customer with 3 active tokens
// gets 3 Expo messages from a single send() call; one bad token can never
// block or duplicate delivery to the others, and no extra Notification
// documents are ever created for the extra devices.
const PushToken = require('../../models/PushToken');
// Imported as a module object (not destructured) so tests can swap
// expoPushClient.sendExpoPushBatch for a mock and have this file pick it up
// live — the same reasoning as ChannelDispatcher looking up ADAPTERS[channel]
// dynamically rather than caching adapter references at require time.
const expoPushClient = require('./expoPushClient');
const { isValidExpoPushToken } = expoPushClient;
const { FAILURE_TYPE } = require('../../constants/notification.constants');

// Expo error codes that mean the token itself is permanently dead — the
// install was removed, the token was revoked, etc. Anything else (rate
// limiting, oversized payload) is a delivery-attempt problem, not a
// reason to stop ever using that token again.
const TERMINAL_TOKEN_ERROR_CODES = new Set(['DeviceNotRegistered', 'InvalidCredentials']);

// Never put a raw token in anything that gets persisted or logged in full —
// this is purely for the safe providerResponse summary on NotificationDelivery.
const maskToken = (token) => (typeof token === 'string' ? `${token.slice(0, 18)}…${token.slice(-6)}` : token);

const send = async (notification) => {
  const tokens = await PushToken.find({ customer: notification.customer, isActive: true });

  if (tokens.length === 0) {
    return {
      success: false,
      providerMessageId: null,
      providerResponse: null,
      failureType: FAILURE_TYPE.PERMANENT,
      failureReason: 'No active push tokens registered for this customer.',
    };
  }

  const validTokens = tokens.filter((t) => isValidExpoPushToken(t.token));
  const malformedTokens = tokens.filter((t) => !isValidExpoPushToken(t.token));

  // Malformed tokens can't ever succeed and aren't Expo's problem to report
  // on — deactivate them immediately, the same outcome a real Expo
  // DeviceNotRegistered response would produce, without spending a network
  // call to learn what's already knowable locally.
  if (malformedTokens.length > 0) {
    await PushToken.updateMany({ _id: { $in: malformedTokens.map((t) => t._id) } }, { $set: { isActive: false } });
  }

  if (validTokens.length === 0) {
    return {
      success: false,
      providerMessageId: null,
      providerResponse: { deactivatedMalformedTokens: malformedTokens.length },
      failureType: FAILURE_TYPE.PERMANENT,
      failureReason: 'No syntactically valid push tokens registered for this customer.',
    };
  }

  const messages = validTokens.map((t) => ({
    to: t.token,
    title: notification.title,
    body: notification.body,
    data: { notificationId: notification.notificationId, eventType: notification.eventType },
  }));

  let results;
  try {
    results = await expoPushClient.sendExpoPushBatch(messages);
  } catch (error) {
    // Network failure or relay outage — every device is equally affected,
    // none of their tokens are known to be bad, so this is retryable.
    return {
      success: false,
      providerMessageId: null,
      providerResponse: null,
      failureType: FAILURE_TYPE.TRANSIENT,
      failureReason: `Expo push relay request failed: ${error.message}`,
    };
  }

  const tokenIdByValue = new Map(validTokens.map((t) => [t.token, t._id]));
  const terminallyFailedTokenIds = results
    .filter((r) => !r.success && TERMINAL_TOKEN_ERROR_CODES.has(r.errorCode))
    .map((r) => tokenIdByValue.get(r.to))
    .filter(Boolean);

  if (terminallyFailedTokenIds.length > 0) {
    // Deactivated individually as a direct side effect of what Expo told us
    // about each specific token — never retried again, per "invalid/stale
    // tokens must be safely deactivated rather than repeatedly retried
    // forever." The other devices' tokens are completely unaffected.
    await PushToken.updateMany({ _id: { $in: terminallyFailedTokenIds } }, { $set: { isActive: false } });
  }

  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  const providerResponse = {
    attempted: results.length,
    succeeded: succeeded.length,
    failed: failed.length,
    perToken: results.map((r) => ({
      token: maskToken(r.to),
      status: r.success ? 'ok' : 'error',
      errorCode: r.errorCode || undefined,
    })),
  };

  if (succeeded.length > 0) {
    // At least one device got it — the notification as a whole succeeded.
    // Individual device failures are fully recorded in providerResponse
    // above without blocking this outcome.
    return {
      success: true,
      providerMessageId: succeeded.map((r) => r.id).join(','),
      providerResponse,
      failureType: null,
      failureReason: null,
    };
  }

  // Every device failed. If every failure was a terminal token error, this
  // is permanent (retrying won't help — those tokens are now deactivated
  // anyway). Any non-terminal failure (rate limit, oversized message) means
  // it's worth retrying.
  const allTerminal = failed.every((r) => TERMINAL_TOKEN_ERROR_CODES.has(r.errorCode));
  return {
    success: false,
    providerMessageId: null,
    providerResponse,
    failureType: allTerminal ? FAILURE_TYPE.PERMANENT : FAILURE_TYPE.TRANSIENT,
    failureReason: `All ${failed.length} device(s) failed: ${failed.map((r) => r.errorCode || r.errorMessage).join(', ')}`,
  };
};

module.exports = { send };
