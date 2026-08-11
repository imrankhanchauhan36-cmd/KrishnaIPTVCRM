const mongoose = require('mongoose');
const { CHANNELS, DELIVERY_ATTEMPT_STATUS, FAILURE_TYPE } = require('../constants/notification.constants');

// One document per delivery ATTEMPT — never overwritten, never reused across
// retries. This is the audit trail the Notification document's own
// sentAt/failedAt/retryCount fields summarize but do not replace.
const notificationDeliverySchema = new mongoose.Schema(
  {
    notification: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification', required: true },
    channel: { type: String, enum: Object.values(CHANNELS), required: true },
    attemptNumber: { type: Number, required: true },
    status: { type: String, enum: Object.values(DELIVERY_ATTEMPT_STATUS), required: true },
    attemptedAt: { type: Date, default: Date.now },

    providerMessageId: { type: String },
    // Safe subset of the provider's response only (e.g. a status code or
    // provider-issued reference) — never raw provider credentials/secrets.
    providerResponse: { type: mongoose.Schema.Types.Mixed },

    failureType: { type: String, enum: Object.values(FAILURE_TYPE) },
    failureReason: { type: String },
  },
  { timestamps: true }
);

// Every delivery-log view and the retry counter both query by notification,
// most recent attempt first.
notificationDeliverySchema.index({ notification: 1, attemptedAt: -1 });
notificationDeliverySchema.index({ status: 1 });

module.exports = mongoose.model('NotificationDelivery', notificationDeliverySchema);
