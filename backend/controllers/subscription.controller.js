const Subscription = require('../models/Subscription');
const Customer = require('../models/Customer');
const {
  calculateRenewalDate,
  calculateInitialPanelExpiry,
  calculateRemainingDaysNeeded,
  resolvePlanReference,
  resolveEmployeeReference,
  resolvePortalReference,
  resolveOrCreateDevice,
} = require('../services/subscription.service');
const { logActivity } = require('../services/activityLog.service');
const { safeRaiseEvent } = require('../services/notification.service');
const { EVENT_TYPES } = require('../constants/notification.constants');

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
    const {
      customer,
      plan,
      priceUSD,
      durationType,
      durationValue,
      startingDate,
      panelAddedDays,
      macAddress,
      planId,
      employeeId,
      employeeName,
      portalId,
      portalUrl,
    } = req.body;

    // A customer may legitimately run multiple concurrent Active subscriptions
    // (e.g. one per device/panel), so creating a new one is never blocked by
    // an existing Active subscription — each is independent.

    // Additive: when a real Plan Master / Employee Master / Portal Master
    // record is referenced, its current value is authoritative — never the
    // client-typed text. Falls back to whatever was sent when no ID is
    // given, so any caller that doesn't yet send planId/employeeId/portalId
    // keeps working exactly as before.
    const planRef = await resolvePlanReference(planId);
    const employeeRef = await resolveEmployeeReference(employeeId);
    const portalRef = await resolvePortalReference(portalId);
    const finalPlanName = planRef ? planRef.planName : plan;

    const renewalDate = calculateRenewalDate(startingDate, durationType, durationValue);
    const panelExpiryDate = calculateInitialPanelExpiry(startingDate, panelAddedDays);

    // Resolve the device first (when a MAC is given) so its _id can be linked
    // onto the subscription below — this is what lets the UI show which
    // physical device a given subscription belongs to. Reuses an existing
    // device with the same MAC for this customer instead of creating a
    // duplicate.
    const { device: savedDevice, created: deviceCreated } = await resolveOrCreateDevice(customer, macAddress);
    if (deviceCreated) {
      await logActivity({
        customer,
        action: 'Device Added',
        description: `Device added with MAC ${savedDevice.macAddress}`,
        performedByName: req.user?.fullName || 'Owner',
        performedByType: req.user?.userType || 'Admin',
      });
    }

    const subscription = new Subscription({
      customer,
      plan: finalPlanName,
      priceUSD,
      startingDate: new Date(startingDate),
      panelAddedDays: panelAddedDays ? Number(panelAddedDays) : 0,
      renewalDate,
      panelExpiryDate,
      ...(planRef && { planId: planRef.planId }),
      ...(employeeRef ? { employeeId: employeeRef.employeeId, employeeName: employeeRef.employeeName } : { employeeName }),
      ...(portalRef ? { portalId: portalRef.portalId, portalUrl: portalRef.portalUrl } : { portalUrl }),
      ...(savedDevice && { device: savedDevice._id }),
    });
    const saved = await subscription.save();

    await logActivity({
      customer,
      action: 'Subscription Started',
      description: `Started "${finalPlanName}" plan ($${priceUSD}), renews on ${renewalDate.toDateString()}`,
      performedByName: req.user?.fullName || 'Owner',
      performedByType: req.user?.userType || 'Admin',
    });

    const customerDoc = await Customer.findById(customer).select('fullName').lean();
    await safeRaiseEvent({
      eventType: EVENT_TYPES.SUBSCRIPTION_CREATED,
      customer,
      subscription: saved._id,
      entityId: String(saved._id),
      variables: {
        customerName: customerDoc?.fullName,
        subscriptionPlan: saved.plan,
        renewalDate: new Date(saved.renewalDate).toDateString(),
      },
    });

    res.status(201).json({ subscription: saved, device: savedDevice });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// RENEW: expires the old subscription, creates a fresh Active one
exports.renewSubscription = async (req, res) => {
  try {
    const {
      oldSubscriptionId,
      customer,
      plan,
      priceUSD,
      durationType,
      durationValue,
      startingDate,
      panelAddedDays,
      employeeName,
      portalUrl,
      planId,
      employeeId,
      portalId,
      macAddress,
    } = req.body;

    if (!customer || (!plan && !planId) || priceUSD === undefined || priceUSD === null || !durationType || !durationValue || !startingDate) {
      return res.status(400).json({ message: 'Missing required renewal fields' });
    }

    let carriedDeviceId = null;
    if (oldSubscriptionId) {
      const oldSubscription = await Subscription.findById(oldSubscriptionId);
      const expireUpdate = { status: 'Expired' };
      // Trial -> paid conversion: mark the old trial's funnel outcome as
      // Converted whenever it's being renewed into a paid plan.
      if (oldSubscription && oldSubscription.priceUSD === 0 && Number(priceUSD) > 0) {
        expireUpdate.trialStatus = 'Converted';
        expireUpdate.followUpStatus = 'Converted';
      }
      await Subscription.findByIdAndUpdate(oldSubscriptionId, expireUpdate);
      // Renewing keeps the same physical device — carry the link forward so
      // it survives the old-expires/new-created cycle instead of being lost.
      carriedDeviceId = oldSubscription?.device || null;
    }

    // An explicit macAddress on the renewal always wins over the carried-
    // forward link — this is what lets an owner assign the correct device to
    // a subscription that was renewed before subscriptions tracked one at
    // all (reuses the existing device by MAC instead of duplicating it).
    let deviceCreated = false;
    if (macAddress) {
      const resolved = await resolveOrCreateDevice(customer, macAddress);
      carriedDeviceId = resolved.device._id;
      deviceCreated = resolved.created;
      if (deviceCreated) {
        await logActivity({
          customer,
          action: 'Device Added',
          description: `Device added with MAC ${resolved.device.macAddress}`,
          performedByName: req.user?.fullName || 'Owner',
          performedByType: req.user?.userType || 'Admin',
        });
      }
    }

    // Additive: same authoritative-value-from-ID resolution as
    // createSubscription, with the same unchanged fallback for callers that
    // don't send planId/employeeId/portalId.
    const planRef = await resolvePlanReference(planId);
    const employeeRef = await resolveEmployeeReference(employeeId);
    const portalRef = await resolvePortalReference(portalId);
    const finalPlanName = planRef ? planRef.planName : plan;

    const renewalDate = calculateRenewalDate(startingDate, durationType, durationValue);
    const panelExpiryDate = calculateInitialPanelExpiry(startingDate, panelAddedDays);

    const newSubscription = new Subscription({
      customer,
      plan: finalPlanName,
      priceUSD: Number(priceUSD),
      startingDate: new Date(startingDate),
      panelAddedDays: panelAddedDays ? Number(panelAddedDays) : 0,
      renewalDate,
      panelExpiryDate,
      employeeName: employeeRef ? employeeRef.employeeName : employeeName,
      portalUrl: portalRef ? portalRef.portalUrl : portalUrl,
      status: 'Active',
      ...(planRef && { planId: planRef.planId }),
      ...(employeeRef && { employeeId: employeeRef.employeeId }),
      ...(portalRef && { portalId: portalRef.portalId }),
      ...(carriedDeviceId && { device: carriedDeviceId }),
    });
    const saved = await newSubscription.save();

    await logActivity({
      customer,
      action: 'Subscription Renewed',
      description: `Renewed with plan "${finalPlanName}", renews on ${renewalDate.toDateString()}`,
      performedByName: req.user?.fullName || 'Owner',
      performedByType: req.user?.userType || 'Admin',
    });

    const customerDoc = await Customer.findById(customer).select('fullName').lean();
    await safeRaiseEvent({
      eventType: EVENT_TYPES.SUBSCRIPTION_RENEWED,
      customer,
      subscription: saved._id,
      entityId: String(saved._id),
      variables: {
        customerName: customerDoc?.fullName,
        subscriptionPlan: saved.plan,
        renewalDate: new Date(saved.renewalDate).toDateString(),
      },
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

// PATCH /:id/status - update trialStatus and/or followUpStatus only
exports.updateSubscriptionStatus = async (req, res) => {
  try {
    const { trialStatus, followUpStatus } = req.body;
    const update = {};
    if (trialStatus !== undefined) update.trialStatus = trialStatus;
    if (followUpStatus !== undefined) update.followUpStatus = followUpStatus;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'Provide trialStatus and/or followUpStatus to update' });
    }

    const subscription = await Subscription.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!subscription) return res.status(404).json({ message: 'Subscription not found' });

    await logActivity({
      customer: subscription.customer,
      action: 'Follow-up Status Updated',
      description: [
        trialStatus ? `Trial: ${trialStatus}` : null,
        followUpStatus ? `Follow-up: ${followUpStatus}` : null,
      ]
        .filter(Boolean)
        .join(' — '),
      performedByName: req.user?.fullName || 'Owner',
      performedByType: req.user?.userType || 'Admin',
    });

    res.json(subscription);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// One-time repair for historical subscriptions created before subscriptions
// tracked a device (see Subscription.device). Deliberately requires the
// operator to pick the device explicitly — never inferred from timestamps
// or any other heuristic, and only ever a device that already belongs to
// this subscription's own customer.
exports.assignDevice = async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ message: 'deviceId is required' });
    }

    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) return res.status(404).json({ message: 'Subscription not found' });

    const Device = require('../models/Device');
    const device = await Device.findById(deviceId);
    if (!device) return res.status(404).json({ message: 'Device not found' });
    if (device.customer.toString() !== subscription.customer.toString()) {
      return res.status(400).json({ message: 'That device does not belong to this subscription\'s customer' });
    }

    subscription.device = device._id;
    await subscription.save();

    await logActivity({
      customer: subscription.customer,
      action: 'Device Assigned',
      description: `Assigned device (MAC ${device.macAddress}) to "${subscription.plan}" subscription`,
      performedByName: req.user?.fullName || 'Owner',
      performedByType: req.user?.userType || 'Admin',
    });

    const customerDoc = await Customer.findById(subscription.customer).select('fullName').lean();
    await safeRaiseEvent({
      eventType: EVENT_TYPES.DEVICE_ASSIGNED,
      customer: subscription.customer,
      subscription: subscription._id,
      entityId: String(subscription._id),
      variables: {
        customerName: customerDoc?.fullName,
        subscriptionPlan: subscription.plan,
        deviceName: device.deviceName || device.deviceType,
        macAddress: device.macAddress,
      },
    });

    res.json(subscription);
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
