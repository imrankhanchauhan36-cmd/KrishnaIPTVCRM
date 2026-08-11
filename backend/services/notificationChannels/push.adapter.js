// PUSH channel adapter — interface only. No push provider (FCM/APNs) is
// configured in this environment yet, and the Customer App that would own
// device push tokens does not exist yet either (see PushToken concept in
// the Notification API layer for the future registration shape). Swap
// `send` below for a real FCM/APNs client once both exist — the
// NotificationEngine and ChannelDispatcher require no changes to pick it up.
const { makeStubAdapter } = require('./stubAdapter');

module.exports = makeStubAdapter('PUSH');
