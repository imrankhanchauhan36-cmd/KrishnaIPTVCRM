const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    whatsappNumber: { type: String, required: true, trim: true },
    status: { type: String, enum: ['Active', 'Expired', 'Inactive'], default: 'Active' },
    createdBy: { type: String, default: 'Owner' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Customer', customerSchema);
