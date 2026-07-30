const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    deviceName: { type: String },
    deviceType: {
      type: String,
      enum: ['Smart TV', 'Android TV', 'Fire TV Stick', 'Apple TV', 'MAG Box', 'Other'],
      default: 'Other',
    },
    macAddress: { type: String, required: true, trim: true, uppercase: true },
    addedDate: { type: String },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Device', deviceSchema);
