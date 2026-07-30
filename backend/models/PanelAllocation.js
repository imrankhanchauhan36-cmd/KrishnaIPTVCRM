const mongoose = require('mongoose');

const panelAllocationSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true },
    purchasedMonths: { type: Number, required: true },
    addedMonths: { type: Number, default: 0 },
    remainingMonths: { type: Number, default: 0 },
    panelExpiryDate: { type: Date, required: true },
    status: { type: String, enum: ['Active', 'Expiring', 'Expired'], default: 'Active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PanelAllocation', panelAllocationSchema);
