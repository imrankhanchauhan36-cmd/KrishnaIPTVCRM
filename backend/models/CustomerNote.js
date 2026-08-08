const mongoose = require('mongoose');

const customerNoteSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    note: { type: String, required: true },
    createdByName: { type: String },
    createdByType: { type: String, enum: ['Admin', 'Employee'] },
  },
  { timestamps: true }
);

// Both the customer profile note list and the timeline aggregator query by
// customer sorted by recency — index-only, no document touched.
customerNoteSchema.index({ customer: 1, createdAt: -1 });

module.exports = mongoose.model('CustomerNote', customerNoteSchema);
