require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Device = require('../models/Device');
const Subscription = require('../models/Subscription');
const ActivityLog = require('../models/ActivityLog');

const merge = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const primary = await Customer.findOne({ customerId: 'KIPTV823' });
  const duplicate = await Customer.findOne({ customerId: 'KIPTV824' });

  if (!primary || !duplicate) {
    console.log('Could not find one or both customers.');
    process.exit(1);
  }

  await Device.updateMany({ customer: duplicate._id }, { customer: primary._id });
  await Subscription.updateMany({ customer: duplicate._id }, { customer: primary._id });
  await ActivityLog.updateMany({ customer: duplicate._id }, { customer: primary._id });
  await Customer.deleteOne({ _id: duplicate._id });

  const latestSub = await Subscription.findOne({ customer: primary._id }).sort({ panelExpiryDate: -1 });
  if (latestSub) {
    const isExpired = new Date(latestSub.panelExpiryDate) < new Date();
    primary.status = isExpired ? 'Expired' : 'Active';
    await primary.save();
  }

  console.log(`Merged KIPTV824 into KIPTV823 (${primary.fullName}).`);
  const finalCount = await Customer.countDocuments({ isDeleted: false });
  console.log(`Final customer count: ${finalCount}`);
  process.exit(0);
};
merge();
