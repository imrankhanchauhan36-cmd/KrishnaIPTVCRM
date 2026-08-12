const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Customer = require('../models/Customer');
const CustomerOtp = require('../models/CustomerOtp');
const RefreshToken = require('../models/RefreshToken');
const { findByPhone } = require('./customer.service');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 30; // longer than staff (7d) — a customer re-entering a 4-digit OTP every week is poor UX for a subscription-status app
const OTP_EXPIRY_MINUTES = 5;
const OTP_LENGTH = 4;

// This project has no SMS/WhatsApp OTP provider and, per explicit business
// decision, will not integrate one for this private ~2,000-customer portal.
// CUSTOMER_AUTH_MODE gates HOW the generated code is handed to the customer
// — everything below it (hashing, expiry, attempt-limiting, JWT issuance)
// is provider-agnostic, so swapping in a real SMS/WhatsApp send later only
// ever touches the one branch in requestOtp() that currently returns the
// code inline, never this file's auth architecture.
const CUSTOMER_AUTH_MODE = process.env.CUSTOMER_AUTH_MODE || 'INTERNAL_OTP';

const hashToken = (value) => crypto.createHash('sha256').update(value).digest('hex');

const generateOtpCode = () => String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');

const generateAccessToken = (customer) =>
  jwt.sign({ id: customer._id, userType: 'Customer', tokenVersion: 1 }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

const generateRefreshToken = async (customer, deviceInfo = '') => {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const hashedToken = hashToken(rawToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await RefreshToken.create({
    token: hashedToken,
    userId: customer._id,
    userType: 'Customer',
    expiresAt,
    deviceInfo,
  });

  return rawToken;
};

// Step 1: customer submits their registered phone number. Looks the
// customer up via the existing fuzzy findByPhone (same lookup the staff
// duplicate-check screen already uses) — never creates a customer, never
// reveals whether a number is registered beyond issuing (or not) an OTP.
const requestOtp = async (phone) => {
  if (!phone || !String(phone).trim()) {
    throw new Error('Phone number is required');
  }

  const customer = await findByPhone(phone);
  if (!customer) {
    throw new Error('No account found for this phone number. Please contact support.');
  }
  if (customer.isDeleted) {
    throw new Error('This account is no longer active. Please contact support.');
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await CustomerOtp.create({
    customer: customer._id,
    codeHash: hashToken(code),
    expiresAt,
  });

  const result = {
    customerId: customer.customerId,
    expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
  };

  // The ONLY branch that will ever change when/if this business adopts a
  // real SMS/WhatsApp OTP provider — everything above and below is
  // delivery-mechanism-agnostic.
  if (CUSTOMER_AUTH_MODE === 'INTERNAL_OTP') {
    result.otp = code; // never logged — returned directly to the requesting client only
  }

  return result;
};

// Step 2: customer submits the code. Always re-resolves the customer from
// the phone number again (never trusts a client-supplied customerId), finds
// their most recent unconsumed OTP row, and enforces expiry + attempt limit
// server-side before ever comparing hashes.
const verifyOtp = async (phone, code, deviceInfo = '') => {
  if (!phone || !code) {
    throw new Error('Phone number and OTP are required');
  }

  const customer = await findByPhone(phone);
  if (!customer) {
    throw new Error('No account found for this phone number.');
  }

  const otpRow = await CustomerOtp.findOne({ customer: customer._id, consumedAt: null }).sort({ createdAt: -1 });
  if (!otpRow) {
    throw new Error('No OTP request found. Please request a new code.');
  }
  if (otpRow.expiresAt < new Date()) {
    throw new Error('This OTP has expired. Please request a new code.');
  }
  if (otpRow.attempts >= otpRow.maxAttempts) {
    throw new Error('Too many incorrect attempts. Please request a new code.');
  }

  const isMatch = otpRow.codeHash === hashToken(String(code).trim());
  if (!isMatch) {
    otpRow.attempts += 1;
    await otpRow.save();
    throw new Error('Incorrect OTP.');
  }

  otpRow.consumedAt = new Date();
  await otpRow.save();

  const accessToken = generateAccessToken(customer);
  const refreshToken = await generateRefreshToken(customer, deviceInfo);

  return {
    accessToken,
    refreshToken,
    customer: {
      _id: customer._id,
      customerId: customer.customerId,
      fullName: customer.fullName,
      whatsappNumber: customer.whatsappNumber,
    },
  };
};

const refreshAccessToken = async (refreshTokenValue) => {
  const hashedToken = hashToken(refreshTokenValue);
  const storedToken = await RefreshToken.findOne({ token: hashedToken, userType: 'Customer', revoked: false });

  if (!storedToken || storedToken.expiresAt < new Date()) {
    throw new Error('Refresh token is invalid or expired. Please log in again.');
  }

  const customer = await Customer.findById(storedToken.userId);
  if (!customer || customer.isDeleted) {
    throw new Error('Account not found or inactive.');
  }

  const accessToken = generateAccessToken(customer);
  return { accessToken };
};

const logout = async (refreshTokenValue) => {
  const hashedToken = hashToken(refreshTokenValue);
  await RefreshToken.findOneAndUpdate({ token: hashedToken, userType: 'Customer' }, { revoked: true });
};

const logoutAllDevices = async (customerId) => {
  await RefreshToken.updateMany({ userId: customerId, userType: 'Customer' }, { revoked: true });
};

module.exports = {
  requestOtp,
  verifyOtp,
  refreshAccessToken,
  logout,
  logoutAllDevices,
  CUSTOMER_AUTH_MODE,
};
