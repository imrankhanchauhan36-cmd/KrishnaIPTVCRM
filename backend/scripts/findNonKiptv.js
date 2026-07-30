require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../models/Customer');

const find = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const nonKiptv = await Customer.find({
    isDeleted: false,
    customerId: { $not: /^KIPTV/ },
  });
  console.log(`Found ${nonKiptv.length} customers NOT starting with "KIPTV":\n`);
  nonKiptv.forEach((c) => {
    console.log(`- ${c.fullName} | ${c.customerId} | ${c.whatsappNumber} | created: ${c.createdAt}`);
  });
  process.exit(0);
};
find();
