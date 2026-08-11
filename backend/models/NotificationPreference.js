const mongoose = require('mongoose');

// One preference document per customer. Absent = all defaults (everything
// on) — created lazily the first time a customer's preferences are read or
// written, so this is purely additive and never required at customer
// creation time.
const notificationPreferenceSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true },

    // Channel-level opt-out — applies to every category, including
    // transactional. A customer who disables WhatsApp entirely should never
    // get a WhatsApp message, even a transactional one.
    channels: {
      inApp: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
    },

    // Category-level opt-out. Transactional notifications are deliberately
    // NOT included here — they always go out (subject to the channel
    // switches above) per the spec's "never mix transactional and
    // promotional rules" requirement. Reminder/promotional are the only
    // categories a customer can turn off independently of channel choice.
    categories: {
      reminder: { type: Boolean, default: true },
      promotional: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('NotificationPreference', notificationPreferenceSchema);
