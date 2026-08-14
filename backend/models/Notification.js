const mongoose = require('mongoose');
const {
  EVENT_TYPES,
  CHANNELS,
  NOTIFICATION_STATUS,
  NOTIFICATION_CATEGORY,
  PRIORITY,
} = require('../constants/notification.constants');

const notificationSchema = new mongoose.Schema(
  {
    notificationId: { type: String, required: true, unique: true },
    eventType: { type: String, enum: Object.values(EVENT_TYPES), required: true },
    notificationCategory: { type: String, enum: Object.values(NOTIFICATION_CATEGORY), required: true },

    // Recipient — a Customer for every event type except
    // STAFF_TEST_NOTIFICATION (Staff Push phase), kept as a dedicated ref
    // (matching the Subscription/Device/Payment/ActivityLog convention)
    // rather than a generic polymorphic reference, since every customer-
    // facing V1 event originates from a customer-owned business record.
    // required is conditional (not simply true) so the brand-new
    // recipientType:'STAFF' path can coexist without ever touching this
    // field's meaning or requiredness for any existing/customer event —
    // every pre-existing document already has `customer` set and is
    // completely unaffected.
    recipientType: { type: String, enum: ['CUSTOMER', 'STAFF'], default: 'CUSTOMER' },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: function () {
        return this.recipientType !== 'STAFF';
      },
    },
    // Staff/Owner App recipient (Admin or Employee) — populated only when
    // recipientType is 'STAFF'. Mirrors StaffPushToken's staffId/staffType
    // discriminator; never used for, or mixed with, the customer path above.
    staffRecipient: {
      staffId: { type: mongoose.Schema.Types.ObjectId, refPath: 'staffRecipient.staffType' },
      staffType: { type: String, enum: ['Admin', 'Employee'] },
    },
    // Optional traceability back to the record that caused this event.
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },

    title: { type: String, required: true },
    body: { type: String, required: true },
    templateId: { type: String, required: true },

    channel: { type: String, enum: Object.values(CHANNELS), required: true },
    priority: { type: String, enum: Object.values(PRIORITY), required: true },
    status: { type: String, enum: Object.values(NOTIFICATION_STATUS), default: NOTIFICATION_STATUS.PENDING },

    scheduledAt: { type: Date, default: Date.now },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    failedAt: { type: Date },
    failureReason: { type: String },

    retryCount: { type: Number, default: 0 },
    // When the sweep should next attempt a retryable PENDING notification.
    // Null/unset means "attempt as soon as the dispatcher picks it up."
    nextRetryAt: { type: Date },

    providerMessageId: { type: String },

    // Deterministic per (event, recipient, channel, effective-date) key —
    // see services/notification.service.js buildIdempotencyKey. Uniqueness
    // is enforced at the database level below, not just in application code.
    idempotencyKey: { type: String, required: true, unique: true },

    // Non-sensitive contextual data only (e.g. reminderStage, deviceName,
    // macAddress, planName) — never JWTs, passwords, or provider secrets.
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// The dispatcher's core query: "give me due, undelivered notifications."
notificationSchema.index({ status: 1, scheduledAt: 1 });
// Notification list / unread count for a given customer, newest first —
// same shape as every other per-customer index in this codebase.
notificationSchema.index({ customer: 1, createdAt: -1 });
// Same shape, for the Owner App's staff-scoped list/unread-count queries.
notificationSchema.index({ 'staffRecipient.staffId': 1, createdAt: -1 });
notificationSchema.index({ eventType: 1 });
notificationSchema.index({ channel: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
