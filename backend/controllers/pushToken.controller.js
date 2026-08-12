const PushToken = require('../models/PushToken');
const { isValidExpoPushToken } = require('../services/notificationChannels/expoPushClient');

// Registration metadata is safe to return; the raw token string is not —
// nothing legitimately needs to read it back once stored, so every
// response strips it rather than exposing it "just in case."
const toSafeToken = (doc) => {
  const obj = doc.toObject ? doc.toObject() : doc;
  const { token, ...safe } = obj;
  return safe;
};

// POST /api/push-tokens — register (or refresh) a device token. Upsert on
// the token itself so a reinstall/refresh with the same token is idempotent
// rather than accumulating duplicates. Requires staff auth (protect) — this
// is a write that ties a real device to a real customer's notification
// stream, not a read.
exports.registerToken = async (req, res) => {
  try {
    const { customer, token, platform, previousToken } = req.body;
    if (!customer || !token || !platform) {
      return res.status(400).json({ message: 'customer, token, and platform are required' });
    }
    if (!isValidExpoPushToken(token)) {
      return res.status(400).json({ message: 'token is not a recognized Expo push token' });
    }

    const saved = await PushToken.findOneAndUpdate(
      { token },
      { customer, token, platform, isActive: true, lastSeenAt: new Date() },
      { new: true, upsert: true, runValidators: true }
    );

    // Token refresh: the client knows its old token was replaced by this
    // new one — deactivate the old one so it's never attempted again,
    // without deleting its history.
    if (previousToken && previousToken !== token) {
      await PushToken.updateOne({ token: previousToken, customer }, { $set: { isActive: false } });
    }

    res.status(201).json(toSafeToken(saved));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// GET /api/push-tokens/customer/:customerId — every active token for a
// customer, i.e. every device the Push adapter would fan out to. Never
// returns the raw token value.
exports.getTokensForCustomer = async (req, res) => {
  try {
    const tokens = await PushToken.find({ customer: req.params.customerId, isActive: true });
    res.json(tokens.map(toSafeToken));
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
    res.json(toSafeToken(updated));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ---- Customer self-service (User App) — identity ALWAYS from the verified
// JWT (req.user.id), never trusted from the request body. Same PushToken
// collection as the staff-facing functions above; a customer's own web-push
// subscription (platform:'web', token = JSON.stringify(subscription)) is
// indistinguishable in storage from an Owner-App-registered token for that
// same customer — this is intentional, they're the same recipient. ----

const requireCustomer = (req, res) => {
  if (req.user.userType !== 'Customer') {
    res.status(403).json({ message: 'This endpoint is for customer accounts only' });
    return false;
  }
  return true;
};

// POST /api/push-tokens/me
exports.registerMyToken = async (req, res) => {
  try {
    if (!requireCustomer(req, res)) return;
    const { token, platform, previousToken } = req.body;
    if (!token || !platform) {
      return res.status(400).json({ message: 'token and platform are required' });
    }
    // Web Push subscriptions are JSON blobs, not Expo-token-shaped strings —
    // isValidExpoPushToken only applies to the Owner/Staff Expo path, so it
    // is deliberately NOT called here.

    const saved = await PushToken.findOneAndUpdate(
      { token },
      { customer: req.user.id, token, platform, isActive: true, lastSeenAt: new Date() },
      { new: true, upsert: true, runValidators: true }
    );

    if (previousToken && previousToken !== token) {
      await PushToken.updateOne({ token: previousToken, customer: req.user.id }, { $set: { isActive: false } });
    }

    res.status(201).json(toSafeToken(saved));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// GET /api/push-tokens/me
exports.getMyTokens = async (req, res) => {
  try {
    if (!requireCustomer(req, res)) return;
    const tokens = await PushToken.find({ customer: req.user.id, isActive: true });
    res.json(tokens.map(toSafeToken));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/push-tokens/me/:id/invalidate — scoped to the caller's own
// tokens only; another customer's token id returns 404, not 403.
exports.invalidateMyToken = async (req, res) => {
  try {
    if (!requireCustomer(req, res)) return;
    const updated = await PushToken.findOneAndUpdate(
      { _id: req.params.id, customer: req.user.id },
      { isActive: false },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Push token not found' });
    res.json(toSafeToken(updated));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
