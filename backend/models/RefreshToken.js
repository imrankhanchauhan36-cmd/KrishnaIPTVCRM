const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userType: { type: String, enum: ['Admin', 'Employee', 'Customer'], required: true },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
    deviceInfo: { type: String }, // optional: track which device this login is from
  },
  { timestamps: true }
);

// Auto-delete expired tokens from database (MongoDB TTL index)
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
