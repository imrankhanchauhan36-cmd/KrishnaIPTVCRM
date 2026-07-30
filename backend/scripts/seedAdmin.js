require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

const seedAdmin = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await Admin.findOne({ email: 'owner@krishnaiptv.com' });
  if (existing) {
    console.log('⚠️  Admin already exists:', existing.email);
    process.exit(0);
  }

  const admin = new Admin({
    fullName: 'Krishna IPTV Owner',
    email: 'owner@krishnaiptv.com',
    password: 'Owner@123',
    role: 'owner',
  });

  await admin.save();
  console.log('✅ Admin created successfully!');
  console.log('Email: owner@krishnaiptv.com');
  console.log('Password: Owner@123');
  console.log('⚠️  Please change this password after first login.');
  process.exit(0);
};

seedAdmin().catch((err) => {
  console.error('❌ Error seeding admin:', err.message);
  process.exit(1);
});
