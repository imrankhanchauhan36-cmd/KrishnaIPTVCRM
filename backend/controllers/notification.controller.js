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
// Only counts notifications that actually reached (or are still trying to
// reach) the customer — PENDING/SENT/DELIVERED. FAILED and SKIPPED never
// reached them, so there is nothing to "read"; counting those meant a
// customer whose device had no active push token (the common case before
// they ever register one) could accumulate a badge count that mark-all-read
// could never fully clear, since it already correctly excludes FAILED.
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      customer: req.params.customerId,
      status: { $in: [NOTIFICATION_STATUS.PENDING, NOTIFICATION_STATUS.SENT, NOTIFICATION_STATUS.DELIVERED] },
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

// ---- Customer self-service (User App) — identity ALWAYS from the verified
// JWT (req.user.id), never a client-supplied :customerId. The existing
// customer/:customerId routes above stay exactly as-is (staff/Owner-App
// usage, trusted caller supplies an arbitrary id on purpose); these are
// separate endpoints, not a modification of those. ----

const requireCustomerUser = (req, res) => {
  if (req.user.userType !== 'Customer') {
    res.status(403).json({ message: 'This endpoint is for customer accounts only' });
    return false;
  }
  return true;
};

// GET /api/notifications/me?page=&limit=&status=&channel=
exports.getMyNotifications = async (req, res) => {
  try {
    if (!requireCustomerUser(req, res)) return;
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { customer: req.user.id };
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

// GET /api/notifications/me/unread-count
exports.getMyUnreadCount = async (req, res) => {
  try {
    if (!requireCustomerUser(req, res)) return;
    const count = await Notification.countDocuments({
      customer: req.user.id,
      status: { $in: [NOTIFICATION_STATUS.PENDING, NOTIFICATION_STATUS.SENT, NOTIFICATION_STATUS.DELIVERED] },
      readAt: null,
    });
    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/notifications/me/read-all
exports.markAllMineAsRead = async (req, res) => {
  try {
    if (!requireCustomerUser(req, res)) return;
    const now = new Date();
    const result = await Notification.updateMany(
      { customer: req.user.id, readAt: null, status: { $ne: NOTIFICATION_STATUS.FAILED } },
      { $set: { readAt: now, status: NOTIFICATION_STATUS.READ } }
    );
    res.json({ matched: result.matchedCount, updated: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/notifications/me/:id/read — ownership enforced: the
// notification must belong to the caller, matched by customer id from the
// JWT, not just the :id in the URL.
exports.markMineAsRead = async (req, res) => {
  try {
    if (!requireCustomerUser(req, res)) return;
    const notification = await Notification.findOne({ _id: req.params.id, customer: req.user.id });
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

// ---- Staff/Owner self-service (Owner App) — identical shape to the
// customer /me endpoints above, scoped by staffRecipient.staffId instead
// of customer. Both come from the verified JWT (req.user.id), never from
// the request, so a staff member can only ever read their own
// notifications — same isolation guarantee the customer path already has. ----

const requireStaffUser = (req, res) => {
  if (req.user.userType === 'Customer') {
    res.status(403).json({ message: 'This endpoint is for staff accounts only' });
    return false;
  }
  return true;
};

// GET /api/notifications/staff/me?page=&limit=&status=&channel=
exports.getMyStaffNotifications = async (req, res) => {
  try {
    if (!requireStaffUser(req, res)) return;
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { 'staffRecipient.staffId': req.user.id };
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

// GET /api/notifications/staff/me/unread-count
exports.getMyStaffUnreadCount = async (req, res) => {
  try {
    if (!requireStaffUser(req, res)) return;
    const count = await Notification.countDocuments({
      'staffRecipient.staffId': req.user.id,
      status: { $in: [NOTIFICATION_STATUS.PENDING, NOTIFICATION_STATUS.SENT, NOTIFICATION_STATUS.DELIVERED] },
      readAt: null,
    });
    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/notifications/staff/me/read-all
exports.markAllStaffMineAsRead = async (req, res) => {
  try {
    if (!requireStaffUser(req, res)) return;
    const now = new Date();
    const result = await Notification.updateMany(
      { 'staffRecipient.staffId': req.user.id, readAt: null, status: { $ne: NOTIFICATION_STATUS.FAILED } },
      { $set: { readAt: now, status: NOTIFICATION_STATUS.READ } }
    );
    res.json({ matched: result.matchedCount, updated: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/notifications/staff/me/:id/read
exports.markStaffMineAsRead = async (req, res) => {
  try {
    if (!requireStaffUser(req, res)) return;
    const notification = await Notification.findOne({ _id: req.params.id, 'staffRecipient.staffId': req.user.id });
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

// POST /api/notifications/admin/test-staff-push — the only place
// STAFF_TEST_NOTIFICATION is ever raised, and the only way STAFF_PUSH
// delivery gets exercised in this phase. Sends to the CALLING admin's own
// registered devices only — staffRecipient comes from req.user (the
// verified JWT), never from the request body, so this can never be used to
// push to another staff member's device. Explicitly bypasses
// EVENT_DEFAULT_CHANNELS via channels:[CHANNELS.STAFF_PUSH] — no business
// event is wired to STAFF_PUSH yet.
exports.testStaffPush = async (req, res) => {
  try {
    const { raiseEvent } = require('../services/notification.service');
    const { CHANNELS, EVENT_TYPES } = require('../constants/notification.constants');

    const created = await raiseEvent({
      eventType: EVENT_TYPES.STAFF_TEST_NOTIFICATION,
      staffRecipient: { staffId: req.user.id, staffType: req.user.userType },
      channels: [CHANNELS.STAFF_PUSH],
    });

    res.json(created);
  } catch (error) {
    res.status(400).json({ message: error.message });
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
