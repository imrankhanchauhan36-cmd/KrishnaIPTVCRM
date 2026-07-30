require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Device = require('../models/Device');
const Subscription = require('../models/Subscription');
const ActivityLog = require('../models/ActivityLog');

// Get last 10 digits of a phone number (ignores country code / formatting differences)
const last10Digits = (phone) => {
  const digitsOnly = (phone || '').replace(/\D/g, '');
  return digitsOnly.slice(-10);
};

const merge = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Scanning for duplicate customers...\n');

  const allCustomers = await Customer.find({ isDeleted: false }).sort({ createdAt: 1 });

  const groups = {};
  allCustomers.forEach((c) => {
    const key = last10Digits(c.whatsappNumber);
    if (!key) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  });

  const duplicateGroups = Object.values(groups).filter((g) => g.length > 1);
  console.log(`Found ${duplicateGroups.length} groups with duplicate phone numbers.\n`);

  let mergedCount = 0;

  for (const group of duplicateGroups) {
    const primary = group[0]; // earliest-created customer becomes the primary
    const duplicates = group.slice(1);

    for (const dup of duplicates) {
      await Device.updateMany({ customer: dup._id }, { customer: primary._id });
      await Subscription.updateMany({ customer: dup._id }, { customer: primary._id });
      await ActivityLog.updateMany({ customer: dup._id }, { customer: primary._id });
      await Customer.deleteOne({ _id: dup._id });
      mergedCount++;
    }

    // Recompute primary's status based on its most recent subscription
    const latestSub = await Subscription.findOne({ customer: primary._id }).sort({ panelExpiryDate: -1 });
    if (latestSub) {
      const isExpired = new Date(latestSub.panelExpiryDate) < new Date();
      primary.status = isExpired ? 'Expired' : 'Active';
      await primary.save();
    }

    console.log(`Merged ${duplicates.length} duplicate(s) into ${primary.fullName} (${primary.customerId})`);
  }

  console.log(`\n🎉 Merge complete! ${mergedCount} duplicate customer records merged.`);
  const finalCount = await Customer.countDocuments({ isDeleted: false });
  console.log(`Final customer count: ${finalCount}`);
  process.exit(0);
};

merge().catch((err) => {
  console.error('❌ Merge failed:', err.message);
  process.exit(1);
});
