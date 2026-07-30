const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    plan: { type: String, required: true },
    priceUSD: { type: Number, required: true },
    startingDate: { type: Date, required: true },
    panelAddedDays: { type: Number, default: 0 },
    renewalDate: { type: Date, required: true },
    panelExpiryDate: { type: Date, required: true },
    employeeName: { type: String },
    portalUrl: { type: String },
    status: { type: String, enum: ['Active', 'Expired'], default: 'Active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subscription', subscriptionSchema);
