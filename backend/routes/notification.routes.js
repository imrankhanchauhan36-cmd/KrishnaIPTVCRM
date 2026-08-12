const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/role.middleware');
const {
  getNotificationsForCustomer,
  getUnreadCount,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  getPreferences,
  updatePreferences,
  getDeliveryLogs,
  getFailedNotifications,
  retryNotification,
  getTemplates,
  runReminderSweepNow,
  testStaffPush,
  getMyNotifications,
  getMyUnreadCount,
  markAllMineAsRead,
  markMineAsRead,
} = require('../controllers/notification.controller');

// Admin-only — declared before the generic "/:id" route below so they can
// never be shadowed by it. First real use of the existing (previously
// dormant) protect/requireAdmin middleware, since these are brand-new
// sensitive endpoints rather than a change to any existing route's auth
// behavior.
router.get('/admin/delivery-logs', protect, requireAdmin, getDeliveryLogs);
router.get('/admin/failed', protect, requireAdmin, getFailedNotifications);
router.post('/admin/:id/retry', protect, requireAdmin, retryNotification);
router.get('/admin/templates', protect, requireAdmin, getTemplates);
// The only way the D-7/D-3/D-1/D-Day/Expired sweep runs against real data,
// unless an operator has separately opted into the periodic timer via
// REMINDER_SCHEDULER_ENABLED=true (see server.js) — deliberately explicit
// and admin-gated rather than automatic.
router.post('/admin/run-reminder-sweep', protect, requireAdmin, runReminderSweepNow);
// Explicit, admin-only, real-device-test trigger for STAFF_PUSH — sends to
// the calling admin's own registered devices only (see controller). Never
// invoked automatically, never wired into any business flow.
router.post('/admin/test-staff-push', protect, requireAdmin, testStaffPush);

// Customer self-service (User App) — authenticated, identity from JWT only.
// Declared before the generic "/:id" route below so "/me..." can never be
// shadowed by it (Express would otherwise match "/me" as :id="me").
router.get('/me', protect, getMyNotifications);
router.get('/me/unread-count', protect, getMyUnreadCount);
router.patch('/me/read-all', protect, markAllMineAsRead);
router.patch('/me/:id/read', protect, markMineAsRead);

// Customer-facing — unauthenticated, matching every other customer route in
// this codebase (no customer-side login system exists yet).
router.get('/customer/:customerId', getNotificationsForCustomer);
router.get('/customer/:customerId/unread-count', getUnreadCount);
router.patch('/customer/:customerId/read-all', markAllAsRead);
router.get('/customer/:customerId/preferences', getPreferences);
router.put('/customer/:customerId/preferences', updatePreferences);
router.get('/:id', getNotificationById);
router.patch('/:id/read', markAsRead);

module.exports = router;
