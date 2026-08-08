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
    // Additive, optional references — the ID is the authoritative link
    // going forward; the string fields above stay populated (server-derived
    // from these IDs when present) so every existing read path keeps
    // working unchanged for both legacy and new records. Absent on every
    // record created before this feature, by design — no backfill.
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeMaster' },
    portalUrl: { type: String },
    portalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Portal' },
    status: { type: String, enum: ['Active', 'Expired'], default: 'Active' },
    // Funnel outcome of a trial (priceUSD === 0) subscription — separate from
    // followUpStatus below, which tracks contact/action state day to day.
    trialStatus: { type: String, enum: ['Pending', 'Converted', 'Lost'], default: 'Pending' },
    // Day-to-day contact/action state, shown on the Trial and Follow-up views.
    followUpStatus: {
      type: String,
      enum: ['Pending', 'Call Today', 'WhatsApp Today', 'No Response', 'Converted', 'Lost', 'Call Back Tomorrow'],
      default: 'Pending',
    },
  },
  { timestamps: true }
);

// Every renewal query (bucket, date, and date-range filters, plus the
// existing dashboard renewal counts) filters on status and ranges over
// renewalDate — this is a metadata/index operation only, it does not read,
// rewrite, or migrate any existing document.
subscriptionSchema.index({ status: 1, renewalDate: 1 });

// getSubscriptionsByCustomer, getCustomerById, and the timeline aggregator
// all query by customer sorted by recency — same index-only, no-migration
// guarantee as above.
subscriptionSchema.index({ customer: 1, createdAt: -1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
