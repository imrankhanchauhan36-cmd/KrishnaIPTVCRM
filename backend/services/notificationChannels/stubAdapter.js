const { FAILURE_TYPE } = require('../../constants/notification.constants');

// Shared shape for every channel that has no configured provider in this
// environment (PUSH, WHATSAPP, SMS, EMAIL in V1). Never makes a network
// call, never reads a credential — there are none to read. This exists so
// each real adapter file below can be swapped for a real implementation
// later without any change to the ChannelDispatcher or NotificationEngine.
const makeStubAdapter = (channelLabel) => ({
  send: async () => ({
    success: false,
    providerMessageId: null,
    providerResponse: null,
    failureType: FAILURE_TYPE.PERMANENT,
    failureReason: `${channelLabel} is not configured in this environment.`,
  }),
});

module.exports = { makeStubAdapter };
