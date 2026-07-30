require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Device = require('../models/Device');
const Subscription = require('../models/Subscription');

const clean = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const custIds = ['KIPTV720', 'KIPTV675', 'KIPTV596', 'KIPTV003', 'KIPTV002'];
  const customers = await Customer.find({ customerId: { $in: custIds } });
  const ids = customers.map(c => c._id);

  await Device.deleteMany({ customer: { $in: ids } });
  await Subscription.deleteMany({ customer: { $in: ids } });
  await Customer.deleteMany({ _id: { $in: ids } });

  console.log(`Cleaned up ${customers.length} test customers.`);
  process.exit(0);
};
clean();
