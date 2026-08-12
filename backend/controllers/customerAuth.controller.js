const customerAuthService = require('../services/customerAuth.service');
const Customer = require('../models/Customer');
const Subscription = require('../models/Subscription');
const Device = require('../models/Device');

// panelAddedDays / panelExpiryDate are internal operational fields (see
// subscription.service.js: "Panel Expiry = Starting Date + Panel Days
// Added" — how long the IPTV panel/server is currently topped up for, an
// implementation detail of keeping the stream alive). The customer's actual
// paid-for service period is renewalDate ("Starting Date + Plan Duration,
// fixed, never affected by panel days") — that field alone is what a
// customer-facing "Valid Until" must be built from. This DTO is the one
// place that boundary is enforced, at the API level, so it holds even if a
// future screen reads the response directly rather than going through the
// existing UI.
const toCustomerSafeSubscription = (sub) => ({
  _id: sub._id,
  plan: sub.plan,
  priceUSD: sub.priceUSD,
  status: sub.status,
  startingDate: sub.startingDate,
  renewalDate: sub.renewalDate,
  createdAt: sub.createdAt,
  device: sub.device,
});

// POST /api/customer-auth/login — step 1: request an OTP for a phone number.
exports.requestOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    const result = await customerAuthService.requestOtp(phone);
    res.json({ message: 'OTP generated', ...result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// POST /api/customer-auth/verify-otp — step 2: verify the code, issue tokens.
exports.verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const deviceInfo = req.headers['user-agent'] || 'Unknown device';
    const result = await customerAuthService.verifyOtp(phone, otp, deviceInfo);
    res.json({ message: 'Login successful', ...result });
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

// POST /api/customer-auth/refresh
exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }
    const result = await customerAuthService.refreshAccessToken(refreshToken);
    res.json(result);
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

// POST /api/customer-auth/logout
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await customerAuthService.logout(refreshToken);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/customer-auth/me — identity comes ONLY from the verified JWT
// (req.user.id), never from any client-supplied id/param. This is what
// guarantees Customer A can never read Customer B's data by editing a URL.
exports.getMe = async (req, res) => {
  try {
    if (req.user.userType !== 'Customer') {
      return res.status(403).json({ message: 'This endpoint is for customer accounts only' });
    }

    const customer = await Customer.findOne({ _id: req.user.id, isDeleted: false });
    if (!customer) return res.status(404).json({ message: 'Account not found' });

    const [subscriptions, devices] = await Promise.all([
      Subscription.find({ customer: customer._id }).sort({ createdAt: -1 }),
      Device.find({ customer: customer._id }),
    ]);

    res.json({ customer, subscriptions: subscriptions.map(toCustomerSafeSubscription), devices });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
