// EMAIL channel adapter — interface only. No email provider (e.g. SMTP,
// SendGrid) is configured in this environment. Swap `send` below for a real
// provider client later — the NotificationEngine and ChannelDispatcher
// require no changes to pick it up.
const { makeStubAdapter } = require('./stubAdapter');

module.exports = makeStubAdapter('EMAIL');
