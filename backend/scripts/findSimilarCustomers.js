require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../models/Customer');

const normalizeName = (name) => {
  return (name || '')
    .toLowerCase()
    .replace(/\bmr\b|\bmrs\b|\bms\b|\bji\b/g, '')
    .replace(/[^a-z]/g, '')
    .trim();
};

const find = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const all = await Customer.find({ isDeleted: false }).sort({ fullName: 1 });

  const groups = {};
  all.forEach((c) => {
    const key = normalizeName(c.fullName);
    if (!key) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  });

  const similarGroups = Object.values(groups).filter((g) => g.length > 1);

  console.log(`Found ${similarGroups.length} groups with same/similar names but different phone numbers:\n`);

  similarGroups.forEach((group) => {
    console.log(`--- ${group[0].fullName} ---`);
    group.forEach((c) => {
      console.log(`   ${c.customerId} | ${c.whatsappNumber} | ${c.email || 'no email'}`);
    });
    console.log('');
  });

  process.exit(0);
};
find();
