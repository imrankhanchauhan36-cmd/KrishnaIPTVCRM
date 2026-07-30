require('dotenv').config();
const mongoose = require('mongoose');

const clearData = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB. Clearing customer-related data...\n');

  const collectionsToDelete = [
    'customers', 'devices', 'subscriptions', 'payments', 'activitylogs'
  ];

  for (const name of collectionsToDelete) {
    const result = await mongoose.connection.db.collection(name).deleteMany({});
    console.log(`🗑️  Cleared ${name}: ${result.deletedCount} documents removed`);
  }

  // Reset customer ID counter so new customers start from KRISH0001
  await mongoose.connection.db.collection('counters').updateOne(
    { name: 'customerId' },
    { $set: { value: 0 } },
    { upsert: true }
  );
  console.log('🔄 Customer ID counter reset to 0');

  console.log('\n✅ Plans and Admin login were NOT touched — they remain intact.');
  console.log('🎉 Cleanup complete! Ready for real customer data.');
  process.exit(0);
};

clearData().catch((err) => {
  console.error('❌ Cleanup failed:', err.message);
  process.exit(1);
});
