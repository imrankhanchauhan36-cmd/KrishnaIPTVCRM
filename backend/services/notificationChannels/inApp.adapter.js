const { FAILURE_TYPE } = require('../../constants/notification.constants');

// IN_APP is the one real, non-stub channel in V1. "Sending" an in-app
// notification IS persisting the Notification record — there is no external
// call to make, so this always succeeds once the record exists. The future
// Customer App reads these back via the notification list/unread APIs.
const send = async (notification) => {
  if (!notification || !notification._id) {
    return {
      success: false,
      providerMessageId: null,
      providerResponse: null,
      failureType: FAILURE_TYPE.PERMANENT,
      failureReason: 'Notification record is missing — nothing to persist.',
    };
  }

  return {
    success: true,
    providerMessageId: String(notification._id),
    providerResponse: { channel: 'IN_APP', persisted: true },
    failureType: null,
    failureReason: null,
  };
};

module.exports = { send };
