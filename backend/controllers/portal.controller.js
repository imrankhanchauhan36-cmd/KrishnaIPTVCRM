// portal controller
const Portal = require('../models/Portal');

exports.getAllPortals = async (req, res) => {
  try {
    const portals = await Portal.find({ isActive: true }).sort({ portalUrl: 1 });
    res.json(portals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createPortal = async (req, res) => {
  try {
    const { portalUrl } = req.body;
    if (!portalUrl || !portalUrl.trim()) {
      return res.status(400).json({ message: 'Portal URL is required' });
    }
    const portal = new Portal({ portalUrl: portalUrl.trim() });
    const saved = await portal.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updatePortal = async (req, res) => {
  try {
    const updated = await Portal.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ message: 'Portal not found' });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Soft delete only — matches Plan/EmployeeMaster's pattern exactly. Never
// hard deletes, so any subscription already referencing this portal by ID
// keeps resolving correctly.
exports.deletePortal = async (req, res) => {
  try {
    const updated = await Portal.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!updated) return res.status(404).json({ message: 'Portal not found' });
    res.json({ message: 'Portal removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
