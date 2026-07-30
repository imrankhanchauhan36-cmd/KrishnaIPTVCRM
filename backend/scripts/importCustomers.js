require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Device = require('../models/Device');
const Subscription = require('../models/Subscription');

// Parses dates like "27Feb23", "26Aug23", "14/08/25" into a JS Date
const parseFlexibleDate = (str) => {
  if (!str || !str.trim()) return null;
  const s = str.trim();

  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    let [, day, month, year] = slashMatch;
    if (year.length === 2) year = '20' + year;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const monthMap = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const compactMatch = s.match(/^(\d{1,2})([A-Za-z]{3})(\d{2,4})$/);
  if (compactMatch) {
    let [, day, monStr, year] = compactMatch;
    const month = monthMap[monStr.toLowerCase()];
    if (month === undefined) return null;
    if (year.length === 2) year = '20' + year;
    return new Date(Number(year), month, Number(day));
  }

  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const extractDurationFromPlan = (planStr) => {
  if (!planStr) return { type: 'months', value: 1 };
  const s = planStr.toLowerCase();
  if (s.includes('year')) {
    const match = s.match(/(\d+)/);
    const years = match ? parseInt(match[1], 10) : 1;
    return { type: 'months', value: years * 12 };
  }
  if (s.includes('day')) {
    const match = s.match(/(\d+)/);
    return { type: 'days', value: match ? parseInt(match[1], 10) : 1 };
  }
  const match = s.match(/(\d+)/);
  return { type: 'months', value: match ? parseInt(match[1], 10) : 1 };
};

const normalizePhone = (phone) => {
  if (!phone) return '';
  return phone.replace(/[\s\-\(\)]/g, '');
};

const runImport = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB. Starting import...\n');

  const csvPath = path.join(__dirname, '..', 'krishna_customers.csv');
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const rows = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`Found ${rows.length} rows in CSV.\n`);

  let customersCreated = 0;
  let customersReused = 0;
  let devicesCreated = 0;
  let subscriptionsCreated = 0;
  let skipped = 0;
  const errors = [];

  // In-memory cache: normalized phone -> customer document
  const phoneToCustomer = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 because row 1 is header, and arrays are 0-indexed

    try {
      const fullName = (row['Full Name'] || '').trim();
      const rawPhone = (row['WhatsApp Number'] || '').trim();
      const phone = normalizePhone(rawPhone);
      const email = (row['Email Address'] || '').trim().toLowerCase();
      const mac = (row['MAC Address'] || '').trim().toUpperCase();
      const startingDateStr = (row['Starting Date'] || '').trim();
      const panelAddedDaysStr = (row['Pannel Added Days'] || '').trim();
      const planStr = (row['Plans '] || row['Plans'] || '').trim();
      const priceStr = (row['Price in USD'] || '').trim().replace('$', '');
      const employeeName = (row['Employee Name'] || '').trim();
      const portalUrl = (row['Portal Url '] || row['Portal Url'] || '').trim();
      const legacyCustomerId = (row['Customer ID'] || '').trim();
      const panelExpiryStr = (row['Pannel Expiry Date'] || '').trim();
      const renewalStr = (row['Renewal  Date '] || row['Renewal Date'] || '').trim();

      if (!fullName || !phone) {
        skipped++;
        errors.push(`Row ${rowNum}: Missing name or phone, skipped.`);
        continue;
      }

      const startingDate = parseFlexibleDate(startingDateStr);
      const panelExpiryDate = parseFlexibleDate(panelExpiryStr);
      const renewalDate = parseFlexibleDate(renewalStr) || panelExpiryDate;
      const priceUSD = parseFloat(priceStr) || 0;
      const panelAddedDays = parseInt(panelAddedDaysStr, 10) || 0;
      const { type: durationType, value: durationValue } = extractDurationFromPlan(planStr);

      // Check if customer already exists (in-memory cache first, then DB)
      let customer = phoneToCustomer[phone];

      if (!customer) {
        customer = await Customer.findOne({ whatsappNumber: phone });
      }

      if (!customer) {
        // Create new customer, preserving legacy Customer ID if present
        const isExpired = panelExpiryDate && panelExpiryDate < new Date();
        customer = new Customer({
          customerId: legacyCustomerId || `LEGACY${rowNum}`,
          fullName,
          email,
          whatsappNumber: phone,
          status: isExpired ? 'Expired' : 'Active',
        });
        await customer.save();
        customersCreated++;
      } else {
        customersReused++;
      }

      phoneToCustomer[phone] = customer;

      // Create device if MAC address provided and not already linked
      if (mac) {
        const existingDevice = await Device.findOne({ customer: customer._id, macAddress: mac });
        if (!existingDevice) {
          await Device.create({
            customer: customer._id,
            macAddress: mac,
            addedDate: startingDateStr,
          });
          devicesCreated++;
        }
      }

      // Create subscription with EXACT dates from the sheet (no recalculation)
      if (planStr && startingDate) {
        const subIsExpired = panelExpiryDate && panelExpiryDate < new Date();
        await Subscription.create({
          customer: customer._id,
          plan: planStr,
          priceUSD,
          startingDate,
          panelAddedDays,
          renewalDate: renewalDate || startingDate,
          panelExpiryDate: panelExpiryDate || renewalDate || startingDate,
          employeeName,
          portalUrl,
          status: subIsExpired ? 'Expired' : 'Active',
        });
        subscriptionsCreated++;

        // Always keep the customer's overall status in sync with this
        // (most recently processed) subscription's expiry status.
        const newCustomerStatus = subIsExpired ? 'Expired' : 'Active';
        if (customer.status !== newCustomerStatus) {
          customer.status = newCustomerStatus;
          await customer.save();
        }
      }

      if ((i + 1) % 100 === 0) {
        console.log(`Processed ${i + 1}/${rows.length} rows...`);
      }
    } catch (error) {
      skipped++;
      errors.push(`Row ${rowNum}: ${error.message}`);
    }
  }

  console.log('\n========== IMPORT SUMMARY ==========');
  console.log(`✅ New customers created: ${customersCreated}`);
  console.log(`♻️  Existing customers reused (same phone): ${customersReused}`);
  console.log(`📺 Devices created: ${devicesCreated}`);
  console.log(`📋 Subscriptions created: ${subscriptionsCreated}`);
  console.log(`⚠️  Rows skipped/errored: ${skipped}`);
  console.log('=====================================\n');

  if (errors.length > 0) {
    console.log('First 20 errors/skips:');
    errors.slice(0, 20).forEach((e) => console.log(`  - ${e}`));
  }

  process.exit(0);
};

runImport().catch((err) => {
  console.error('❌ Import failed:', err.message);
  process.exit(1);
});
