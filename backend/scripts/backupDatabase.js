require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const os = require('os');

const COLLECTIONS = [
  'customers', 'devices', 'subscriptions', 'payments', 'plans',
  'activitylogs', 'admins', 'employees', 'counters'
];

const backup = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB. Starting backup...');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Save locally
  const localDir = path.join(__dirname, '..', 'backups', timestamp);
  fs.mkdirSync(localDir, { recursive: true });

  // Save to Google Drive (auto-syncs to cloud)
  const driveBase = path.join(
    os.homedir(),
    'Library',
    'CloudStorage',
    'GoogleDrive-abhisalesabhi@gmail.com',
    'My Drive',
    'KrishnaIPTV_Backups'
  );
  const driveDir = path.join(driveBase, timestamp);
  let driveAvailable = true;
  try {
    fs.mkdirSync(driveDir, { recursive: true });
  } catch (error) {
    driveAvailable = false;
    console.log('⚠️  Google Drive folder not accessible, skipping cloud copy.');
  }

  for (const collectionName of COLLECTIONS) {
    try {
      const data = await mongoose.connection.db.collection(collectionName).find({}).toArray();
      const json = JSON.stringify(data, null, 2);

      fs.writeFileSync(path.join(localDir, `${collectionName}.json`), json);
      if (driveAvailable) {
        fs.writeFileSync(path.join(driveDir, `${collectionName}.json`), json);
      }

      console.log(`✅ Backed up ${collectionName}: ${data.length} documents`);
    } catch (error) {
      console.log(`⚠️  Skipped ${collectionName}: ${error.message}`);
    }
  }

  console.log(`\n🎉 Backup complete!`);
  console.log(`Local copy: ${localDir}`);
  if (driveAvailable) {
    console.log(`Google Drive copy: ${driveDir} (syncs to cloud automatically)`);
  }
  process.exit(0);
};

backup().catch((err) => {
  console.error('❌ Backup failed:', err.message);
  process.exit(1);
});
