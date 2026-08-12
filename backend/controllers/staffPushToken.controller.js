const StaffPushToken = require('../models/StaffPushToken');
const { isValidExpoPushToken } = require('../services/notificationChannels/expoPushClient');

// Registration metadata is safe to return; the raw token string is not —
// same convention as pushToken.controller.js's toSafeToken.
const toSafeToken = (doc) => {
  const obj = doc.toObject ? doc.toObject() : doc;
  const { token, ...safe } = obj;
  return safe;
};

// POST /api/staff-push-tokens — register (or refresh) a device token for
// the CALLING staff member's own identity. staffId/staffType are always
// derived from the verified JWT (req.user), never trusted from the request
// body — a client could otherwise register a device against any other
// staff member's identity just by editing the payload. Upsert on the token
// itself so a reinstall/refresh with the same token is idempotent rather
// than accumulating duplicates, same pattern as PushToken's registerToken.
exports.registerToken = async (req, res) => {
  try {
    const { token, platform, previousToken } = req.body;
    const staffId = req.user.id;
    const staffType = req.user.userType;

    if (!['Admin', 'Employee'].includes(staffType)) {
      return res.status(403).json({ message: 'Only an Admin or Employee identity can register a staff device.' });
    }
    if (!token || !platform) {
      return res.status(400).json({ message: 'token and platform are required' });
    }
    if (!isValidExpoPushToken(token)) {
      return res.status(400).json({ message: 'token is not a recognized Expo push token' });
    }

    const saved = await StaffPushToken.findOneAndUpdate(
      { token },
      { staffId, staffType, token, platform, isActive: true, lastSeenAt: new Date() },
      { new: true, upsert: true, runValidators: true }
    );

    // Token refresh: deactivate the old token so it's never attempted
    // again, without deleting its history — scoped to this same staff
    // identity so it can never deactivate a device belonging to someone else.
    if (previousToken && previousToken !== token) {
      await StaffPushToken.updateOne({ token: previousToken, staffId, staffType }, { $set: { isActive: false } });
    }

    res.status(201).json(toSafeToken(saved));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// GET /api/staff-push-tokens/me — every active device for the
// authenticated staff identity only. Never accepts a staffId from the
// caller (query/params), so one staff member can never enumerate another's
// devices — the identity comes exclusively from req.user.
exports.getMyTokens = async (req, res) => {
  try {
    const tokens = await StaffPushToken.find({
      staffId: req.user.id,
      staffType: req.user.userType,
      isActive: true,
    });
    res.json(tokens.map(toSafeToken));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/staff-push-tokens/:id/invalidate — logout / uninstall / token
// rejected by provider. The match filter includes staffId/staffType from
// the JWT (not just :id from the URL), so a staff member can only ever
// invalidate their own device — attempting another staff member's token id
// returns 404, not 403, to avoid confirming the id exists.
exports.invalidateToken = async (req, res) => {
  try {
    const updated = await StaffPushToken.findOneAndUpdate(
      { _id: req.params.id, staffId: req.user.id, staffType: req.user.userType },
      { isActive: false },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Staff push token not found' });
    res.json(toSafeToken(updated));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
