const Customer = require('../models/Customer');
const Device = require('../models/Device');
const Subscription = require('../models/Subscription');
const ActivityLog = require('../models/ActivityLog');
const Counter = require('../models/Counter');
const { logActivity } = require('../services/activityLog.service');

const generateCustomerId = async () => {
  const counter = await Counter.findOneAndUpdate(
    { name: 'customerId' },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );
  const paddedNumber = String(counter.value).padStart(4, '0');
  return `KRISH${paddedNumber}`;
};

const buildSmartSearchQuery = (searchValue) => {
  const value = searchValue.trim();

  if (value.includes('@')) {
    return { email: value.toLowerCase() };
  }
  if (value.toUpperCase().startsWith('KRISH')) {
    return { customerId: value.toUpperCase() };
  }
  return { whatsappNumber: value };
};

// GET all customers (excludes soft-deleted) - includes MAC address + active plan for list view
exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({ isDeleted: false }).sort({ createdAt: -1 }).lean();

    const customerIds = customers.map((c) => c._id);

    const devices = await Device.find({ customer: { $in: customerIds } });
    const subscriptions = await Subscription.find({
      customer: { $in: customerIds },
      status: 'Active',
    });

    const deviceMap = {};
    devices.forEach((d) => {
      const key = d.customer.toString();
      if (!deviceMap[key]) deviceMap[key] = d.macAddress;
    });

    const subMap = {};
    subscriptions.forEach((s) => {
      subMap[s.customer.toString()] = {
        subscriptionId: s._id,
        plan: s.plan,
        renewalDate: s.renewalDate,
        panelExpiryDate: s.panelExpiryDate,
        employeeName: s.employeeName,
      };
    });

    const enriched = customers.map((c) => ({
      ...c,
      macAddress: deviceMap[c._id.toString()] || null,
      activePlan: subMap[c._id.toString()]?.plan || null,
      activeSubscriptionId: subMap[c._id.toString()]?.subscriptionId || null,
      renewalDate: subMap[c._id.toString()]?.renewalDate || null,
      panelExpiryDate: subMap[c._id.toString()]?.panelExpiryDate || null,
      employeeName: subMap[c._id.toString()]?.employeeName || null,
    }));

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET single customer WITH devices + subscriptions + activity history
exports.getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, isDeleted: false });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const devices = await Device.find({ customer: customer._id });
    const subscriptions = await Subscription.find({ customer: customer._id }).sort({ createdAt: -1 });
    const activityLog = await ActivityLog.find({ customer: customer._id }).sort({ createdAt: -1 });

    res.json({ customer, devices, subscriptions, activityLog });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /check-duplicate - smart search by phone, email, or customer ID
exports.checkDuplicate = async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || !query.trim()) {
      return res.json({ exists: false });
    }

    const searchQuery = buildSmartSearchQuery(query);
    const existing = await Customer.findOne({ ...searchQuery, isDeleted: false });

    if (existing) {
      return res.json({ exists: true, customer: existing });
    }
    res.json({ exists: false });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// CREATE customer (+ optional Device + optional Subscription, all in one request)
exports.createCustomer = async (req, res) => {
  try {
    const {
      customerId,
      email,
      whatsappNumber,
      fullName,
      status,
      macAddress,
      plan,
      durationType,
      durationValue,
      priceUSD,
      startingDate,
      panelAddedDays,
      employeeName,
      portalUrl,
    } = req.body;

    if (!whatsappNumber || !fullName) {
      return res.status(400).json({ message: 'Full Name and WhatsApp number are required' });
    }

    const duplicateQuery = [{ whatsappNumber }];
    if (email) duplicateQuery.push({ email: email.toLowerCase() });

    const existing = await Customer.findOne({ $or: duplicateQuery, isDeleted: false });
    if (existing) {
      return res.status(409).json({
        message: 'A customer with this email or WhatsApp number already exists',
        customer: existing,
      });
    }

    const newCustomerId = await generateCustomerId();
    const customer = new Customer({
      customerId: newCustomerId,
      email,
      whatsappNumber,
      fullName,
      status: status || 'Active',
    });
    const savedCustomer = await customer.save();

    let savedDevice = null;
    if (macAddress) {
      const device = new Device({ customer: savedCustomer._id, macAddress });
      savedDevice = await device.save();

      await logActivity({
        customer: savedCustomer._id,
        action: 'Device Added',
        description: `Device added with MAC ${macAddress}`,
        performedByName: req.user?.fullName || 'Owner',
        performedByType: req.user?.userType || 'Admin',
      });
    }

    let savedSubscription = null;
    if (plan && priceUSD !== undefined && startingDate && durationType && durationValue) {
      const { calculateRenewalDate, calculateInitialPanelExpiry } = require('../services/subscription.service');
      const renewalDate = calculateRenewalDate(startingDate, durationType, durationValue);
      const panelExpiryDate = calculateInitialPanelExpiry(startingDate, panelAddedDays);

      const subscription = new Subscription({
        customer: savedCustomer._id,
        plan,
        priceUSD: Number(priceUSD),
        startingDate: new Date(startingDate),
        panelAddedDays: panelAddedDays ? Number(panelAddedDays) : 0,
        renewalDate,
        panelExpiryDate,
        employeeName,
        portalUrl,
      });
      savedSubscription = await subscription.save();

      await logActivity({
        customer: savedCustomer._id,
        action: 'Subscription Started',
        description: `Started "${plan}" plan ($${priceUSD}), expiry ${panelExpiryDate.toDateString()}`,
        performedByName: req.user?.fullName || 'Owner',
        performedByType: req.user?.userType || 'Admin',
      });
    }

    await logActivity({
      customer: savedCustomer._id,
      action: 'Customer Created',
      description: `${savedCustomer.fullName} added as a new customer`,
      performedByName: req.user?.fullName || 'Owner',
      performedByType: req.user?.userType || 'Admin',
    });

    res.status(201).json({
      customer: savedCustomer,
      device: savedDevice,
      subscription: savedSubscription,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// UPDATE customer
exports.updateCustomer = async (req, res) => {
  try {
    const { customerId, ...updateData } = req.body;
    const updatedCustomer = await Customer.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      updateData,
      { new: true, runValidators: true }
    );
    if (!updatedCustomer) return res.status(404).json({ message: 'Customer not found' });

    await logActivity({
      customer: updatedCustomer._id,
      action: 'Customer Updated',
      description: `${updatedCustomer.fullName}'s details were updated`,
      performedByName: req.user?.fullName || 'Owner',
      performedByType: req.user?.userType || 'Admin',
    });

    res.json(updatedCustomer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// SOFT DELETE customer
exports.deleteCustomer = async (req, res) => {
  try {
    const deletedCustomer = await Customer.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
    if (!deletedCustomer) return res.status(404).json({ message: 'Customer not found' });

    await logActivity({
      customer: deletedCustomer._id,
      action: 'Customer Deleted',
      description: `${deletedCustomer.fullName} was removed`,
      performedByName: req.user?.fullName || 'Owner',
      performedByType: req.user?.userType || 'Admin',
    });

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
