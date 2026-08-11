const PushToken = require('../models/PushToken');

// POST /api/push-tokens — register (or refresh) a device token. Upsert on
// the token itself so a reinstall/refresh with the same token is idempotent
// rather than accumulating duplicates.
exports.registerToken = async (req, res) => {
  try {
    const { customer, token, platform } = req.body;
    if (!customer || !token || !platform) {
      return res.status(400).json({ message: 'customer, token, and platform are required' });
    }

    const saved = await PushToken.findOneAndUpdate(
      { token },
      { customer, token, platform, isActive: true, lastSeenAt: new Date() },
      { new: true, upsert: true, runValidators: true }
    );
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// GET /api/push-tokens/customer/:customerId — every active token for a
// customer, i.e. every device the future engine would fan out a PUSH
// notification to.
exports.getTokensForCustomer = async (req, res) => {
  try {
    const tokens = await PushToken.find({ customer: req.params.customerId, isActive: true });
    res.json(tokens);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/push-tokens/:id/invalidate — logout / uninstall / token
// rejected by the provider. Soft-deactivate rather than delete, so the
// registration history stays auditable.
exports.invalidateToken = async (req, res) => {
  try {
    const updated = await PushToken.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!updated) return res.status(404).json({ message: 'Push token not found' });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
