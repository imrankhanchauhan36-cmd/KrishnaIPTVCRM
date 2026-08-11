const { CHANNELS, CONFIGURED_CHANNELS } = require('../../constants/notification.constants');
const inAppAdapter = require('./inApp.adapter');
const pushAdapter = require('./push.adapter');
const whatsappAdapter = require('./whatsapp.adapter');
const smsAdapter = require('./sms.adapter');
const emailAdapter = require('./email.adapter');

// The only place that maps a channel constant to its adapter implementation.
// NotificationEngine never talks to a specific provider directly — it only
// ever calls dispatchToChannel(channel, notification) below.
const ADAPTERS = Object.freeze({
  [CHANNELS.IN_APP]: inAppAdapter,
  [CHANNELS.PUSH]: pushAdapter,
  [CHANNELS.WHATSAPP]: whatsappAdapter,
  [CHANNELS.SMS]: smsAdapter,
  [CHANNELS.EMAIL]: emailAdapter,
});

const isChannelConfigured = (channel) => CONFIGURED_CHANNELS.includes(channel);

// Every adapter's send() contract:
//   returns { success, providerMessageId, providerResponse, failureType, failureReason }
// Never throws — a thrown error from an adapter is treated as a transient
// failure by the caller so a bug in one adapter can never crash the engine.
const dispatchToChannel = async (channel, notification) => {
  const adapter = ADAPTERS[channel];
  if (!adapter) {
    return {
      success: false,
      providerMessageId: null,
      providerResponse: null,
      failureType: 'PERMANENT',
      failureReason: `Unsupported channel "${channel}" — no adapter registered.`,
    };
  }
  try {
    return await adapter.send(notification);
  } catch (error) {
    return {
      success: false,
      providerMessageId: null,
      providerResponse: null,
      failureType: 'TRANSIENT',
      failureReason: `Adapter threw unexpectedly: ${error.message}`,
    };
  }
};

module.exports = { dispatchToChannel, isChannelConfigured, ADAPTERS };
