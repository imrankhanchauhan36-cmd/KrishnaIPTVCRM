const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    durationType: { type: String, enum: ['days', 'months'], required: true, default: 'months' },
    durationValue: { type: Number, required: true },
    priceUSD: { type: Number, required: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Plan', planSchema);
