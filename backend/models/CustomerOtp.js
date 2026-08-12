const mongoose = require('mongoose');

// Ephemeral OTP-login state, deliberately kept OUT of the Customer document
// itself (mirrors this codebase's existing RefreshToken pattern — auth
// state lives in its own collection, never bolted onto the core business
// record). One row per requested OTP; a customer can have several rows
// over time (old ones just age out via the TTL index below), but only the
// most recently requested, unconsumed, non-expired one is ever valid.
const customerOtpSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    // sha256 of the 4-digit code — same lightweight-hash technique
    // auth.service.js already uses for refresh tokens (hashToken). Not
    // bcrypt: this value is short-lived (minutes) and attempt-limited, so a
    // slow KDF buys nothing extra here.
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    // Set the moment verification succeeds — a consumed row can never be
    // verified again, even if still within its expiry window.
    consumedAt: { type: Date },
  },
  { timestamps: true }
);

customerOtpSchema.index({ customer: 1, createdAt: -1 });
// Auto-delete rows well after they can possibly matter — 1 hour past
// creation is generous relative to the few-minute expiresAt window, purely
// cleanup, not a security control.
customerOtpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

module.exports = mongoose.model('CustomerOtp', customerOtpSchema);
