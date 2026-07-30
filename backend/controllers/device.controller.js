const Device = require('../models/Device');
const { logActivity } = require('../services/activityLog.service');

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

    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteDevice = async (req, res) => {
  try {
    const deleted = await Device.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Device not found' });

    await logActivity({
      customer: deleted.customer,
      action: 'Device Removed',
      description: `Device with MAC ${deleted.macAddress} was removed`,
      performedByName: req.user?.fullName || 'Owner',
      performedByType: req.user?.userType || 'Admin',
    });

    res.json({ message: 'Device deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
