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

module.exports = mongoose.model('CustomerNote', customerNoteSchema);
