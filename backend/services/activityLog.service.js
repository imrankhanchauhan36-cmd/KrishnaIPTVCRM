const ActivityLog = require('../models/ActivityLog');

const logActivity = async ({ customer, action, description, performedByName, performedByType }) => {
  try {
    await ActivityLog.create({
      customer,
      action,
      description,
      performedByName: performedByName || 'System',
      performedByType: performedByType || 'System',
    });
  } catch (error) {
    console.error('Failed to log activity:', error.message);
  }
};

module.exports = { logActivity };
