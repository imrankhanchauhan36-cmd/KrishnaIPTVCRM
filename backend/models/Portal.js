// Portal model
const mongoose = require('mongoose');

// A minimal master list of portal URLs — mirrors Plan/EmployeeMaster
// exactly. Populates the Portal URL dropdown on Customer Create, Trial, and
// Renewal/Add Subscription screens.
const portalSchema = new mongoose.Schema(
  {
    portalUrl: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

portalSchema.index({ isActive: 1 });

module.exports = mongoose.model('Portal', portalSchema);
