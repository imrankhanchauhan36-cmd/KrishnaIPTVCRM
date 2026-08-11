const Device = require('../models/Device');
const Subscription = require('../models/Subscription');
const { logActivity } = require('../services/activityLog.service');
const { safeRaiseEvent } = require('../services/notification.service');
const { EVENT_TYPES } = require('../constants/notification.constants');

exports.getDevicesByCustomer = async (req, res) => {
  try {
    const devices = await Device.find({ customer: req.params.customerId });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createDevice = async (req, res) => {
  try {
    const device = new Device(req.body);
    const saved = await device.save();

    await logActivity({
      customer: saved.customer,
      action: 'Device Added',
      description: `Device added with MAC ${saved.macAddress}`,
      performedByName: req.user?.fullName || 'Owner',
      performedByType: req.user?.userType || 'Admin',
    });

    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateDevice = async (req, res) => {
  try {
    const oldDevice = await Device.findById(req.params.id);
    if (!oldDevice) return res.status(404).json({ message: 'Device not found' });

    const oldMac = oldDevice.macAddress;

    const updated = await Device.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    await logActivity({
      customer: updated.customer,
      action: 'Device Updated',
      description: `MAC changed from ${oldMac} to ${updated.macAddress}`,
      performedByName: req.user?.fullName || 'Owner',
      performedByType: req.user?.userType || 'Admin',
    });

    if (oldMac !== updated.macAddress) {
      const Customer = require('../models/Customer');
      const customerDoc = await Customer.findById(updated.customer).select('fullName').lean();
      await safeRaiseEvent({
        eventType: EVENT_TYPES.DEVICE_CHANGED,
        customer: updated.customer,
        entityId: String(updated._id),
        extra: oldMac,
        variables: {
          customerName: customerDoc?.fullName,
          deviceName: updated.deviceName || updated.deviceType,
          macAddress: updated.macAddress,
        },
      });
    }

    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteDevice = async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) return res.status(404).json({ message: 'Device not found' });

    // Captured read-only, before the clear below, purely so we know which
    // subscriptions to notify afterward — does not change the clear/delete
    // ordering or behavior of the underlying integrity fix in any way.
    const affectedSubscriptions = await Subscription.find({ device: device._id }, '_id plan customer');

    // Clear the reference on every subscription pointing at this device
    // before deleting it, so none are left with a dangling device ObjectId.
    // Done first (and unconditionally, regardless of how many subscriptions
    // reference it) so a mid-failure never leaves a stale reference behind.
    await Subscription.updateMany({ device: device._id }, { $unset: { device: '' } });

    const deleted = await Device.findByIdAndDelete(req.params.id);

    await logActivity({
      customer: deleted.customer,
      action: 'Device Removed',
      description: `Device with MAC ${deleted.macAddress} was removed`,
      performedByName: req.user?.fullName || 'Owner',
      performedByType: req.user?.userType || 'Admin',
    });

    if (affectedSubscriptions.length > 0) {
      const Customer = require('../models/Customer');
      const customerDoc = await Customer.findById(deleted.customer).select('fullName').lean();
      for (const sub of affectedSubscriptions) {
        await safeRaiseEvent({
          eventType: EVENT_TYPES.DEVICE_UNASSIGNED,
          customer: sub.customer,
          subscription: sub._id,
          entityId: String(sub._id),
          extra: String(device._id),
          variables: {
            customerName: customerDoc?.fullName,
            subscriptionPlan: sub.plan,
          },
        });
      }
    }

    res.json({ message: 'Device deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
