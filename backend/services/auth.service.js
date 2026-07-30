const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Admin = require('../models/Admin');
const Employee = require('../models/Employee');
const RefreshToken = require('../models/RefreshToken');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

// Hash a token before storing (SHA-256, one-way — DB leak won't expose usable tokens)
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Generate short-lived Access Token (used for every API request)
const generateAccessToken = (user, userType) => {
  return jwt.sign(
    { id: user._id, role: user.role, userType, tokenVersion: user.tokenVersion || 1 },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

// Generate long-lived Refresh Token (raw value returned to client, hashed value stored in DB)
const generateRefreshToken = async (user, userType, deviceInfo = '') => {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const hashedToken = hashToken(rawToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await RefreshToken.create({
    token: hashedToken,
    userId: user._id,
    userType,
    expiresAt,
    deviceInfo,
  });

  return rawToken; // only the raw token is sent to the client, never the hash
};

// Find a user (Admin or Employee) by email, across both collections
const findUserByEmail = async (email) => {
  let user = await Admin.findOne({ email: email.toLowerCase() });
  if (user) return { user, userType: 'Admin' };

  user = await Employee.findOne({ email: email.toLowerCase() });
  if (user) return { user, userType: 'Employee' };

  return null;
};

// Core login logic: verify credentials, issue tokens
const login = async (email, password, deviceInfo = '') => {
  const result = await findUserByEmail(email);
  if (!result) {
    throw new Error('Invalid email or password');
  }

  const { user, userType } = result;

  if (!user.isActive) {
    throw new Error('This account has been deactivated. Contact your administrator.');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid email or password');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = generateAccessToken(user, userType);
  const refreshToken = await generateRefreshToken(user, userType, deviceInfo);

  return {
    accessToken,
    refreshToken,
    user: user.toJSON(),
    userType,
  };
};

// Issue a new Access Token using a valid Refresh Token
const refreshAccessToken = async (refreshTokenValue) => {
  const hashedToken = hashToken(refreshTokenValue);
  const storedToken = await RefreshToken.findOne({ token: hashedToken, revoked: false });

  if (!storedToken || storedToken.expiresAt < new Date()) {
    throw new Error('Refresh token is invalid or expired. Please log in again.');
  }

  const Model = storedToken.userType === 'Admin' ? Admin : Employee;
  const user = await Model.findById(storedToken.userId);

  if (!user || !user.isActive) {
    throw new Error('User not found or inactive.');
  }

  const accessToken = generateAccessToken(user, storedToken.userType);
  return { accessToken, user: user.toJSON(), userType: storedToken.userType };
};

// Logout: revoke a specific refresh token (single device logout)
const logout = async (refreshTokenValue) => {
  const hashedToken = hashToken(refreshTokenValue);
  await RefreshToken.findOneAndUpdate(
    { token: hashedToken },
    { revoked: true }
  );
};

// Logout from all devices: revoke all refresh tokens for a user
const logoutAllDevices = async (userId) => {
  await RefreshToken.updateMany({ userId }, { revoked: true });
};

module.exports = {
  login,
  refreshAccessToken,
  logout,
  logoutAllDevices,
  findUserByEmail,
};
