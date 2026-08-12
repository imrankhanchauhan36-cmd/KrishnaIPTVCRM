const mongoose = require('mongoose');

// Device registration for the Owner App's OWN login identity (Admin or
// Employee) — deliberately a separate collection from PushToken, which
// stays reserved for a future Customer/User App (PushToken.customer refs
// Customer, a different collection entirely, and is untouched by this
// model). staffType mirrors the existing ActivityLog.performedByType
// discriminator already used elsewhere in this codebase for the same
// Admin/Employee duality; staffId uses refPath so populate() resolves to
// the correct collection without making Customer (or any existing model)
// polymorphic. A staff member can have multiple active devices, same
// multi-device pattern as PushToken.
const staffPushTokenSchema = new mongoose.Schema(
  {
    staffId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'staffType' },
    staffType: { type: String, enum: ['Admin', 'Employee'], required: true },
    token: { type: String, required: true, unique: true, trim: true },
    platform: { type: String, enum: ['ios', 'android', 'web'], required: true },
    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

staffPushTokenSchema.index({ staffId: 1, staffType: 1, isActive: 1 });

module.exports = mongoose.model('StaffPushToken', staffPushTokenSchema);
