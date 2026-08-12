// Thin wrapper around Expo's push relay (https://exp.host). Deliberately
// not the expo-server-sdk package — this project adds zero new backend
// dependencies for Push; Node's built-in fetch (already used throughout
// this codebase's own test scripts) is sufficient for a single batched
// HTTP call. No credentials are required or read here — Expo's push relay
// works directly off a valid Expo push token, which is exactly why this
// channel can be real rather than another stub.
const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

// Every real Expo push token looks like "ExponentPushToken[xxxxxxxx]" (or
// the legacy "ExpoPushToken[...]" form). Anything else is not a token this
// client should ever attempt to send to — catches obviously-fake/malformed
// data before it ever reaches the network.
const EXPO_TOKEN_PATTERN = /^Expo(nent)?PushToken\[.+\]$/;
const isValidExpoPushToken = (token) => typeof token === 'string' && EXPO_TOKEN_PATTERN.test(token);

// Sends one batched request for up to 100 messages (Expo's own per-request
// cap) — a customer with a realistic handful of devices never needs
// chunking, but the cap is enforced defensively rather than assumed.
const MAX_BATCH_SIZE = 100;

// messages: [{ to, title, body, data }]
// Returns: [{ to, success, id, errorCode, errorMessage }] — one entry per
// input message, in the same order, so the caller can map results back to
// the specific token that produced them without any additional bookkeeping.
const sendExpoPushBatch = async (messages) => {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  if (messages.length > MAX_BATCH_SIZE) {
    throw new Error(`sendExpoPushBatch: ${messages.length} messages exceeds Expo's ${MAX_BATCH_SIZE}-per-request limit`);
  }

  const res = await fetch(EXPO_PUSH_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    // A non-2xx here means the whole batch failed (e.g. malformed request,
    // Expo relay outage) — every message in it is treated as failed, but
    // this is a TRANSIENT condition, not a per-token permanent rejection.
    const text = await res.text().catch(() => '');
    throw new Error(`Expo push relay returned HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const tickets = json?.data;
  if (!Array.isArray(tickets) || tickets.length !== messages.length) {
    throw new Error('Expo push relay returned an unexpected response shape');
  }

  return tickets.map((ticket, i) => {
    if (ticket.status === 'ok') {
      return { to: messages[i].to, success: true, id: ticket.id, errorCode: null, errorMessage: null };
    }
    return {
      to: messages[i].to,
      success: false,
      id: null,
      errorCode: ticket.details?.error || null, // e.g. "DeviceNotRegistered", "MessageTooBig", "MessageRateExceeded"
      errorMessage: ticket.message || 'Unknown Expo push error',
    };
  });
};

module.exports = { sendExpoPushBatch, isValidExpoPushToken, EXPO_PUSH_ENDPOINT };
