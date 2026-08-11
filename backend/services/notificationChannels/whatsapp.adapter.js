// WHATSAPP channel adapter — interface only. The official WhatsApp Business
// Platform/API integration is a separate, dedicated milestone. No personal
// WhatsApp automation, WhatsApp Web scraping, or unofficial client is used
// or will ever be used here. No credentials exist in this environment, so
// `send` below deliberately never attempts a real call. Swap it for a real
// WhatsApp Business API client later — the NotificationEngine and
// ChannelDispatcher require no changes to pick it up.
const { makeStubAdapter } = require('./stubAdapter');

module.exports = makeStubAdapter('WHATSAPP');
