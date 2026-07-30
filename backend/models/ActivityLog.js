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

module.exports = mongoose.model('ActivityLog', activityLogSchema);
