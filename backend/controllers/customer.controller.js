const Customer = require('../models/Customer');
const Device = require('../models/Device');
const Subscription = require('../models/Subscription');
const ActivityLog = require('../models/ActivityLog');
const Counter = require('../models/Counter');
const { logActivity } = require('../services/activityLog.service');
const { findExistingCustomer, resolveCanonicalWhatsapp } = require('../services/customer.service');
const { safeRaiseEvent } = require('../services/notification.service');
const { EVENT_TYPES } = require('../constants/notification.constants');

const generateCustomerId = async () => {
  const counter = await Counter.findOneAndUpdate(
    { name: 'customerId' },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );
  const paddedNumber = String(counter.value).padStart(4, '0');
  return `KRISH${paddedNumber}`;
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

    const existing = await findExistingCustomer({ query });

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
      countryCode,
      phoneNumber,
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
      planId,
      employeeId,
      portalId,
    } = req.body;

    // TEMP — remove after verification
    console.log('[PHONE-DEBUG] Incoming request');
    console.log('[PHONE-DEBUG] countryCode:', countryCode);
    console.log('[PHONE-DEBUG] phoneNumber:', phoneNumber);

    const canonicalWhatsapp = resolveCanonicalWhatsapp({ countryCode, phoneNumber, whatsappNumber });
    console.log('[PHONE-DEBUG] canonical phone:', canonicalWhatsapp); // TEMP — remove after verification

    if (!canonicalWhatsapp || !fullName) {
      return res.status(400).json({ message: 'Full Name and WhatsApp number are required' });
    }

    const existing = await findExistingCustomer({ email, phone: canonicalWhatsapp });
    console.log('[PHONE-DEBUG] matched customerId:', existing ? existing.customerId : null); // TEMP — remove after verification
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
      whatsappNumber: canonicalWhatsapp,
      fullName,
      status: status || 'Active',
    });
    const savedCustomer = await customer.save();

    const { resolveOrCreateDevice } = require('../services/subscription.service');
    const { device: savedDevice, created: deviceCreated } = await resolveOrCreateDevice(savedCustomer._id, macAddress);
    if (deviceCreated) {
      await logActivity({
        customer: savedCustomer._id,
        action: 'Device Added',
        description: `Device added with MAC ${savedDevice.macAddress}`,
        performedByName: req.user?.fullName || 'Owner',
        performedByType: req.user?.userType || 'Admin',
      });
    }

    let savedSubscription = null;
    if ((plan || planId) && priceUSD !== undefined && startingDate && durationType && durationValue) {
      const {
        calculateRenewalDate,
        calculateInitialPanelExpiry,
        resolvePlanReference,
        resolveEmployeeReference,
        resolvePortalReference,
      } = require('../services/subscription.service');
      const renewalDate = calculateRenewalDate(startingDate, durationType, durationValue);
      const panelExpiryDate = calculateInitialPanelExpiry(startingDate, panelAddedDays);

      // Additive: same authoritative-value-from-ID resolution used by
      // subscription.controller.js, so the combined create-customer flow
      // stores planId/employeeId/portalId too, not just free text.
      const planRef = await resolvePlanReference(planId);
      const employeeRef = await resolveEmployeeReference(employeeId);
      const portalRef = await resolvePortalReference(portalId);
      const finalPlanName = planRef ? planRef.planName : plan;

      const subscription = new Subscription({
        customer: savedCustomer._id,
        plan: finalPlanName,
        priceUSD: Number(priceUSD),
        startingDate: new Date(startingDate),
        panelAddedDays: panelAddedDays ? Number(panelAddedDays) : 0,
        renewalDate,
        panelExpiryDate,
        employeeName: employeeRef ? employeeRef.employeeName : employeeName,
        portalUrl: portalRef ? portalRef.portalUrl : portalUrl,
        ...(planRef && { planId: planRef.planId }),
        ...(employeeRef && { employeeId: employeeRef.employeeId }),
        ...(portalRef && { portalId: portalRef.portalId }),
        ...(savedDevice && { device: savedDevice._id }),
      });
      savedSubscription = await subscription.save();

      await logActivity({
        customer: savedCustomer._id,
        action: 'Subscription Started',
        description: `Started "${finalPlanName}" plan ($${priceUSD}), expiry ${panelExpiryDate.toDateString()}`,
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

    await safeRaiseEvent({
      eventType: EVENT_TYPES.CUSTOMER_CREATED,
      customer: savedCustomer._id,
      entityId: String(savedCustomer._id),
      variables: { customerName: savedCustomer.fullName },
    });
    if (savedSubscription) {
      await safeRaiseEvent({
        eventType: EVENT_TYPES.SUBSCRIPTION_CREATED,
        customer: savedCustomer._id,
        subscription: savedSubscription._id,
        entityId: String(savedSubscription._id),
        variables: {
          customerName: savedCustomer.fullName,
          subscriptionPlan: savedSubscription.plan,
          renewalDate: new Date(savedSubscription.renewalDate).toDateString(),
        },
      });
    }

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
    const { customerId, countryCode, phoneNumber, ...updateData } = req.body;
    if (phoneNumber || updateData.whatsappNumber) {
      const canonicalWhatsapp = resolveCanonicalWhatsapp({
        countryCode,
        phoneNumber,
        whatsappNumber: updateData.whatsappNumber,
      });
      if (canonicalWhatsapp) updateData.whatsappNumber = canonicalWhatsapp;
    }
    // Fetch the pre-update value so a real phone-number change can be logged
    // with old/new for the timeline — mirrors the existing oldMac pattern in
    // device.controller.js's updateDevice. Purely an extra read; the update
    // itself below is unchanged.
    const previousCustomer = await Customer.findOne({ _id: req.params.id, isDeleted: false });

    const updatedCustomer = await Customer.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      updateData,
      { new: true, runValidators: true }
    );
    if (!updatedCustomer) return res.status(404).json({ message: 'Customer not found' });

    const phoneChanged =
      updateData.whatsappNumber &&
      previousCustomer &&
      updateData.whatsappNumber !== previousCustomer.whatsappNumber;

    await logActivity({
      customer: updatedCustomer._id,
      action: phoneChanged ? 'Phone Number Changed' : 'Customer Updated',
      description: phoneChanged
        ? `Phone number changed from ${previousCustomer.whatsappNumber} to ${updateData.whatsappNumber}`
        : `${updatedCustomer.fullName}'s details were updated`,
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
