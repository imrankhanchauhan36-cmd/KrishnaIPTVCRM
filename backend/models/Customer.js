const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    whatsappNumber: { type: String, required: true, trim: true },
    status: { type: String, enum: ['Active', 'Expired', 'Inactive'], default: 'Active' },
    createdBy: { type: String, default: 'Owner' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    // First time this customer's browser reported running the Customer App
    // PWA in standalone display mode (i.e. launched from an installed home
    // screen icon, not a regular browser tab). Set once, never overwritten —
    // see customerAuth.controller.js markPwaInstalled.
    pwaInstalledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Customer', customerSchema);
