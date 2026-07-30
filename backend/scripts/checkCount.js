require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../models/Customer');

const check = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const total = await Customer.countDocuments();
  const active = await Customer.countDocuments({ status: 'Active' });
  const expired = await Customer.countDocuments({ status: 'Expired' });
  console.log(`Total customers: ${total}`);
  console.log(`Active: ${active}`);
  console.log(`Expired: ${expired}`);
  process.exit(0);
};
check();
