const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    action: { type: String, required: true },
    description: { type: String },
    performedByName: { type: String },
    performedByType: { type: String, enum: ['Admin', 'Employee', 'System'] },
  },
  { timestamps: true }
);

// Every consumer of this collection (getCustomerById, the timeline
// aggregator) queries by customer and sorts by recency — index-only
// operation, no document is read, rewritten, or migrated.
activityLogSchema.index({ customer: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
