// Renewal Date = Starting Date + Plan Duration (fixed, never affected by panel days)
const calculateRenewalDate = (startingDate, durationType, durationValue) => {
  const start = new Date(startingDate);
  const renewalDate = new Date(start);

  if (durationType === 'days') {
    renewalDate.setDate(renewalDate.getDate() + Number(durationValue));
  } else {
    renewalDate.setMonth(renewalDate.getMonth() + Number(durationValue));
  }

  return renewalDate;
};

// Panel Expiry = Starting Date + Panel Days Added (initial, before any top-ups)
const calculateInitialPanelExpiry = (startingDate, panelAddedDays = 0) => {
  const start = new Date(startingDate);
  const panelExpiryDate = new Date(start);
  panelExpiryDate.setDate(panelExpiryDate.getDate() + Number(panelAddedDays || 0));
  return panelExpiryDate;
};

// Days remaining to add so Panel Expiry catches up to Renewal Date
const calculateRemainingDaysNeeded = (panelExpiryDate, renewalDate) => {
  const diffMs = new Date(renewalDate) - new Date(panelExpiryDate);
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

// Resolves the authoritative plan name from Plan Master when a planId is
// given — never trusts client-typed plan text for identity. Returns null
// when no planId (or an unresolvable one) is provided, so callers can fall
// back to their existing free-text behavior unchanged.
const resolvePlanReference = async (planId) => {
  if (!planId) return null;
  const Plan = require('../models/Plan');
  const planDoc = await Plan.findById(planId);
  return planDoc ? { planId: planDoc._id, planName: planDoc.name } : null;
};

// Same pattern for the employee roster.
const resolveEmployeeReference = async (employeeId) => {
  if (!employeeId) return null;
  const EmployeeMaster = require('../models/EmployeeMaster');
  const empDoc = await EmployeeMaster.findById(employeeId);
  return empDoc ? { employeeId: empDoc._id, employeeName: empDoc.employeeName } : null;
};

// Same pattern for the portal URL master.
const resolvePortalReference = async (portalId) => {
  if (!portalId) return null;
  const Portal = require('../models/Portal');
  const portalDoc = await Portal.findById(portalId);
  return portalDoc ? { portalId: portalDoc._id, portalUrl: portalDoc.portalUrl } : null;
};

// Finds the customer's existing device by MAC and reuses it rather than
// creating a duplicate — this is what lets an owner type in an already-known
// MAC while renewing an old subscription (one created before subscriptions
// tracked their device) and have it link to the real device instead of
// spawning a second Device record with the same MAC. Only creates a new
// device when no match exists for this customer. Returns null when no
// macAddress is given, so every existing caller that doesn't send one keeps
// working unchanged.
const resolveOrCreateDevice = async (customer, macAddress) => {
  if (!macAddress) return { device: null, created: false };
  const Device = require('../models/Device');
  const normalizedMac = String(macAddress).trim().toUpperCase();
  const existing = await Device.findOne({ customer, macAddress: normalizedMac });
  if (existing) return { device: existing, created: false };
  const device = new Device({ customer, macAddress: normalizedMac });
  const saved = await device.save();
  return { device: saved, created: true };
};

module.exports = {
  calculateRenewalDate,
  calculateInitialPanelExpiry,
  calculateRemainingDaysNeeded,
  resolvePlanReference,
  resolveEmployeeReference,
  resolvePortalReference,
  resolveOrCreateDevice,
};
