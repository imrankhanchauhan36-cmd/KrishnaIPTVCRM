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

module.exports = {
  calculateRenewalDate,
  calculateInitialPanelExpiry,
  calculateRemainingDaysNeeded,
  resolvePlanReference,
  resolveEmployeeReference,
  resolvePortalReference,
};
