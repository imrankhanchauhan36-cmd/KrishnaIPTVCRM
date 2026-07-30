const Subscription = require('../models/Subscription');
const Device = require('../models/Device');
const {
  calculateRenewalDate,
  calculateInitialPanelExpiry,
  calculateRemainingDaysNeeded,
} = require('../services/subscription.service');
const { logActivity } = require('../services/activityLog.service');

exports.getSubscriptionsByCustomer = async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ customer: req.params.customerId }).sort({
      createdAt: -1,
    });
    res.json(subscriptions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createSubscription = async (req, res) => {
  try {
    const { customer, plan, priceUSD, durationType, durationValue, startingDate, panelAddedDays, macAddress } = req.body;

    const renewalDate = calculateRenewalDate(startingDate, durationType, durationValue);
    const panelExpiryDate = calculateInitialPanelExpiry(startingDate, panelAddedDays);

    const subscription = new Subscription({
      customer,
      plan,
      priceUSD,
      startingDate: new Date(startingDate),
      panelAddedDays: panelAddedDays ? Number(panelAddedDays) : 0,
      renewalDate,
      panelExpiryDate,
    });
    const saved = await subscription.save();

    let savedDevice = null;
    if (macAddress) {
      const device = new Device({ customer, macAddress });
      savedDevice = await device.save();

      await logActivity({
        customer,
        action: 'Device Added',
        description: `Device added with MAC ${macAddress}`,
        performedByName: req.user?.fullName || 'Owner',
        performedByType: req.user?.userType || 'Admin',
      });
    }

    await logActivity({
      customer,
      action: 'Subscription Started',
      description: `Started "${plan}" plan ($${priceUSD}), renews on ${renewalDate.toDateString()}`,
      performedByName: req.user?.fullName || 'Owner',
      performedByType: req.user?.userType || 'Admin',
    });

    res.status(201).json({ subscription: saved, device: savedDevice });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// RENEW: expires the old subscription, creates a fresh Active one
exports.renewSubscription = async (req, res) => {
  try {
    const { oldSubscriptionId, customer, plan, priceUSD, durationType, durationValue, startingDate, panelAddedDays, employeeName, portalUrl } = req.body;

    if (!customer || !plan || priceUSD === undefined || priceUSD === null || !durationType || !durationValue || !startingDate) {
      return res.status(400).json({ message: 'Missing required renewal fields' });
    }

    if (oldSubscriptionId) {
      await Subscription.findByIdAndUpdate(oldSubscriptionId, { status: 'Expired' });
    }

    const renewalDate = calculateRenewalDate(startingDate, durationType, durationValue);
    const panelExpiryDate = calculateInitialPanelExpiry(startingDate, panelAddedDays);

    const newSubscription = new Subscription({
      customer,
      plan,
      priceUSD: Number(priceUSD),
      startingDate: new Date(startingDate),
      panelAddedDays: panelAddedDays ? Number(panelAddedDays) : 0,
      renewalDate,
      panelExpiryDate,
      employeeName,
      portalUrl,
      status: 'Active',
    });
    const saved = await newSubscription.save();

    await logActivity({
      customer,
      action: 'Subscription Renewed',
      description: `Renewed with plan "${plan}", renews on ${renewalDate.toDateString()}`,
      performedByName: req.user?.fullName || 'Owner',
      performedByType: req.user?.userType || 'Admin',
    });

    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ADD PANEL DAYS: top-up panel expiry cumulatively (doesn't touch renewal date)
exports.addPanelDays = async (req, res) => {
  try {
    const { days } = req.body;
    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) return res.status(404).json({ message: 'Subscription not found' });

    if (!days || Number(days) <= 0) {
      return res.status(400).json({ message: 'Please provide a valid number of days' });
    }

    const currentExpiry = new Date(subscription.panelExpiryDate);
    currentExpiry.setDate(currentExpiry.getDate() + Number(days));

    subscription.panelExpiryDate = currentExpiry;
    subscription.panelAddedDays = (subscription.panelAddedDays || 0) + Number(days);
    await subscription.save();

    const remainingDays = calculateRemainingDaysNeeded(subscription.panelExpiryDate, subscription.renewalDate);

    await logActivity({
      customer: subscription.customer,
      action: 'Panel Days Added',
      description: `Added ${days} panel days. New panel expiry: ${currentExpiry.toDateString()}`,
      performedByName: req.user?.fullName || 'Owner',
      performedByType: req.user?.userType || 'Admin',
    });

    res.json({
      subscription,
      remainingDays,
      message:
        remainingDays > 0
          ? `Panel covered until ${currentExpiry.toDateString()}. ${remainingDays} more day(s) needed to reach renewal date.`
          : `Panel is fully covered until the renewal date.`,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteSubscription = async (req, res) => {
  try {
    const deleted = await Subscription.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Subscription not found' });

    await logActivity({
      customer: deleted.customer,
      action: 'Subscription Removed',
      description: `Removed "${deleted.plan}" subscription`,
      performedByName: req.user?.fullName || 'Owner',
      performedByType: req.user?.userType || 'Admin',
    });

    res.json({ message: 'Subscription deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
