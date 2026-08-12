// STAFF_PUSH channel adapter — targets the Owner App's own staff identity
// (Admin/Employee) via StaffPushToken, never PushToken/Customer. Reuses
// expoPushClient.js unchanged — same Expo push relay, no separate provider.
// Only active when an operator has explicitly opted in via
// STAFF_PUSH_ENABLED=true (see constants/notification.constants.js
// CONFIGURED_CHANNELS), independently of PUSH_NOTIFICATIONS_ENABLED.
//
// One Notification (and therefore one attemptDelivery/send() call) always
// maps to exactly one staff identity, never one device — multi-device
// fan-out happens ENTIRELY inside this function, same pattern as
// push.adapter.js.
const StaffPushToken = require('../../models/StaffPushToken');
// Imported as a module object (not destructured) — same reasoning as
// push.adapter.js: keeps expoPushClient.sendExpoPushBatch swappable for
// tests via ChannelDispatcher's dynamic ADAPTERS[channel] lookup.
const expoPushClient = require('./expoPushClient');
const { isValidExpoPushToken } = expoPushClient;
const { FAILURE_TYPE } = require('../../constants/notification.constants');

const TERMINAL_TOKEN_ERROR_CODES = new Set(['DeviceNotRegistered', 'InvalidCredentials']);

const maskToken = (token) => (typeof token === 'string' ? `${token.slice(0, 18)}…${token.slice(-6)}` : token);

const send = async (notification) => {
  const staffId = notification.staffRecipient && notification.staffRecipient.staffId;
  const staffType = notification.staffRecipient && notification.staffRecipient.staffType;

  if (!staffId || !staffType) {
    return {
      success: false,
      providerMessageId: null,
      providerResponse: null,
      failureType: FAILURE_TYPE.PERMANENT,
      failureReason: 'Notification has no staffRecipient — STAFF_PUSH cannot resolve a device to send to.',
    };
  }

  const tokens = await StaffPushToken.find({ staffId, staffType, isActive: true });

  if (tokens.length === 0) {
    return {
      success: false,
      providerMessageId: null,
      providerResponse: null,
      failureType: FAILURE_TYPE.PERMANENT,
      failureReason: 'No active staff push tokens registered for this staff identity.',
    };
  }

  const validTokens = tokens.filter((t) => isValidExpoPushToken(t.token));
  const malformedTokens = tokens.filter((t) => !isValidExpoPushToken(t.token));

  if (malformedTokens.length > 0) {
    await StaffPushToken.updateMany(
      { _id: { $in: malformedTokens.map((t) => t._id) } },
      { $set: { isActive: false } }
    );
  }

  if (validTokens.length === 0) {
    return {
      success: false,
      providerMessageId: null,
      providerResponse: { deactivatedMalformedTokens: malformedTokens.length },
      failureType: FAILURE_TYPE.PERMANENT,
      failureReason: 'No syntactically valid staff push tokens registered for this staff identity.',
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
    await StaffPushToken.updateMany({ _id: { $in: terminallyFailedTokenIds } }, { $set: { isActive: false } });
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
    return {
      success: true,
      providerMessageId: succeeded.map((r) => r.id).join(','),
      providerResponse,
      failureType: null,
      failureReason: null,
    };
  }

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
