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

module.exports = {
  calculateRenewalDate,
  calculateInitialPanelExpiry,
  calculateRemainingDaysNeeded,
};
