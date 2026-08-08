const mongoose = require('mongoose');

// A minimal staff directory — exists only to populate the Employee dropdown
// on Customer Create, Trial, and Renewal screens (2-3 staff, no HR needs).
// Deliberately separate from models/Employee.js, which is a login-capable
// account (required email + password) for a different purpose — reusing
// that model here would force fake credentials onto every roster entry.
const employeeMasterSchema = new mongoose.Schema(
  {
    employeeName: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

employeeMasterSchema.index({ isActive: 1 });

module.exports = mongoose.model('EmployeeMaster', employeeMasterSchema);
