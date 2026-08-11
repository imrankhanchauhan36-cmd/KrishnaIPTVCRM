const mongoose = require('mongoose');

// A customer can have multiple active app installations (phone + tablet,
// or a reinstall that issued a new token) — this is deliberately many
// tokens per customer, not one. The future Customer App registers one of
// these per installation; the PushAdapter (still a stub in V1, no FCM/APNs
// configured) would iterate every isActive:true token for a customer when
// a real provider is wired up.
const pushTokenSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    token: { type: String, required: true, unique: true, trim: true },
    platform: { type: String, enum: ['ios', 'android', 'web'], required: true },
    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

pushTokenSchema.index({ customer: 1, isActive: 1 });

module.exports = mongoose.model('PushToken', pushTokenSchema);
