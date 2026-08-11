const Notification = require('../models/Notification');
const NotificationDelivery = require('../models/NotificationDelivery');
const NotificationPreference = require('../models/NotificationPreference');
const { NOTIFICATION_STATUS } = require('../constants/notification.constants');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE));
  return { page, limit, skip: (page - 1) * limit };
};

// ---- Customer-facing (no auth today — matches every other customer route
// in this codebase; there is no customer-side login system yet) ----

// GET /api/notifications/customer/:customerId?page=&limit=&status=&channel=
exports.getNotificationsForCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { customer: customerId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.channel) filter.channel = req.query.channel;

    const [notifications, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
    ]);

    res.json({ notifications, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/notifications/customer/:customerId/unread-count
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      customer: req.params.customerId,
      status: { $ne: NOTIFICATION_STATUS.READ },
      readAt: null,
    });
    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/notifications/:id — ownership is enforced by the caller knowing
// the customerId; this mirrors every other single-record GET in this
// codebase (no auth layer exists to check "does this belong to you" against
// a logged-in identity yet).
exports.getNotificationById = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/notifications/:id/read
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: 'Notification not found' });

    if (!notification.readAt) {
      notification.readAt = new Date();
      if (notification.status !== NOTIFICATION_STATUS.FAILED) {
        notification.status = NOTIFICATION_STATUS.READ;
      }
      await notification.save();
    }

    res.json(notification);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// PATCH /api/notifications/customer/:customerId/read-all
exports.markAllAsRead = async (req, res) => {
  try {
    const now = new Date();
    const result = await Notification.updateMany(
      { customer: req.params.customerId, readAt: null, status: { $ne: NOTIFICATION_STATUS.FAILED } },
      { $set: { readAt: now, status: NOTIFICATION_STATUS.READ } }
    );
    res.json({ matched: result.matchedCount, updated: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/notifications/customer/:customerId/preferences
exports.getPreferences = async (req, res) => {
  try {
    let pref = await NotificationPreference.findOne({ customer: req.params.customerId });
    if (!pref) {
      // Lazily created with every field at its schema default (all on) —
      // reading preferences must never require the customer to have
      // explicitly set them first.
      pref = await NotificationPreference.create({ customer: req.params.customerId });
    }
    res.json(pref);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/notifications/customer/:customerId/preferences
exports.updatePreferences = async (req, res) => {
  try {
    const { channels, categories } = req.body;
    const update = {};
    if (channels) update.channels = channels;
    if (categories) update.categories = categories;

    const pref = await NotificationPreference.findOneAndUpdate(
      { customer: req.params.customerId },
      { $set: update },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(pref);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ---- Admin-only (protect + requireAdmin applied in routes) ----

// GET /api/notifications/admin/delivery-logs?notificationId=&status=&channel=&page=&limit=
exports.getDeliveryLogs = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.notificationId) filter.notification = req.query.notificationId;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.channel) filter.channel = req.query.channel;

    const [logs, total] = await Promise.all([
      NotificationDelivery.find(filter).sort({ attemptedAt: -1 }).skip(skip).limit(limit),
      NotificationDelivery.countDocuments(filter),
    ]);

    res.json({ logs, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/notifications/admin/failed?page=&limit=
exports.getFailedNotifications = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { status: NOTIFICATION_STATUS.FAILED };

    const [notifications, total] = await Promise.all([
      Notification.find(filter).sort({ failedAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
    ]);

    res.json({ notifications, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/notifications/admin/:id/retry — manual re-arm of a FAILED
// notification. Resets retryCount so the admin gets a fresh full backoff
// cycle (they're asserting the underlying issue is now fixed); does NOT
// touch idempotencyKey, so it remains the exact same logical notification,
// not a duplicate.
exports.retryNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    if (notification.status !== NOTIFICATION_STATUS.FAILED) {
      return res.status(400).json({ message: 'Only FAILED notifications can be retried' });
    }

    notification.status = NOTIFICATION_STATUS.PENDING;
    notification.retryCount = 0;
    notification.nextRetryAt = null;
    notification.failedAt = null;
    notification.failureReason = null;
    await notification.save();

    const { attemptDelivery } = require('../services/notification.service');
    setImmediate(() => {
      attemptDelivery(notification._id).catch((error) => {
        console.error(`[Notification] manual retry crashed for ${notification.notificationId}:`, error.message);
      });
    });

    res.json(notification);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// GET /api/notifications/admin/templates — read-only; templates are
// code-defined/versioned, not editable via API in V1.
exports.getTemplates = async (req, res) => {
  try {
    const { TEMPLATES } = require('../templates/notification.templates');
    res.json(TEMPLATES);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/notifications/admin/run-reminder-sweep — the explicit, admin-
// controlled way to run the D-7/D-3/D-1/D-Day/Expired reminder sweep. This
// is the only way the sweep runs against real production subscriptions
// unless an operator has separately opted into the periodic timer via
// REMINDER_SCHEDULER_ENABLED=true. Overlap-safe: runReminderSweep itself
// refuses to run a second time while one is already in progress.
exports.runReminderSweepNow = async (req, res) => {
  try {
    const { runReminderSweep } = require('../jobs/renewalCheck.job');
    const summary = await runReminderSweep();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
