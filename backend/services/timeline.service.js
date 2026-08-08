// Timeline aggregator — READ ONLY. Assembles a customer's history from
// existing collections (Customer, ActivityLog, CustomerNote, Subscription).
// Introduces no new storage: every event is either a direct read of an
// existing record or a value derived by comparing existing records.
const Customer = require('../models/Customer');
const ActivityLog = require('../models/ActivityLog');
const CustomerNote = require('../models/CustomerNote');
const Subscription = require('../models/Subscription');

// Matches the description device.controller.js's updateDevice already
// writes ("MAC changed from X to Y") — reused here, not duplicated. That
// call fires on every device update regardless of whether the MAC actually
// changed, so we only surface it as a distinct "MAC Address Changed" event
// when the two captured values genuinely differ.
const MAC_CHANGE_PATTERN = /^MAC changed from (.+) to (.+)$/;
const PHONE_CHANGE_PATTERN = /^Phone number changed from (.+) to (.+)$/;

// A subscription log entry and the Subscription document it describes are
// written moments apart in the same request (save, then logActivity) — this
// window is generous enough to always match same-customer events while
// staying well inside "definitely the same action", since a single customer
// can't create two subscriptions in the same request.
const SAME_ACTION_WINDOW_MS = 5000;

const findNearbyLog = (logs, actionName, when) =>
  logs.find(
    (l) => l.action === actionName && Math.abs(new Date(l.createdAt) - new Date(when)) < SAME_ACTION_WINDOW_MS
  );

// Returns null if the customer doesn't exist, otherwise a newest-first array
// of { type, title, description, createdAt, performedBy, metadata }.
const buildCustomerTimeline = async (customerId) => {
  const [customer, activityLogs, notes, subscriptions] = await Promise.all([
    Customer.findById(customerId),
    ActivityLog.find({ customer: customerId }).sort({ createdAt: -1 }),
    CustomerNote.find({ customer: customerId }).sort({ createdAt: -1 }),
    Subscription.find({ customer: customerId }).sort({ createdAt: 1 }),
  ]);

  if (!customer) return null;

  const events = [];

  // ---- Customer Created (one event, log entry preferred for performedBy,
  // falling back to Customer.createdAt for legacy/imported customers that
  // predate activity logging) ----
  const createdLog = activityLogs.find((l) => l.action === 'Customer Created');
  events.push({
    type: 'customer_created',
    title: 'Customer Created',
    description: createdLog?.description || `${customer.fullName} was added as a customer`,
    createdAt: createdLog?.createdAt || customer.createdAt,
    performedBy: createdLog?.performedByName || null,
    metadata: { customerId: customer.customerId },
  });

  // ---- Customer Archived (soft-deleted) ----
  if (customer.isDeleted) {
    const deletedLog = activityLogs.find((l) => l.action === 'Customer Deleted');
    events.push({
      type: 'customer_archived',
      title: 'Customer Archived',
      description: deletedLog?.description || `${customer.fullName} was archived`,
      createdAt: deletedLog?.createdAt || customer.deletedAt || customer.updatedAt,
      performedBy: deletedLog?.performedByName || null,
      metadata: {},
    });
  }

  // ---- Remaining ActivityLog entries, relabeled for the timeline where it
  // adds precision. 'Subscription Started'/'Subscription Renewed' are
  // deliberately skipped here — they're derived from the Subscription
  // documents below instead, with correct trial/plan/price framing, so we
  // never emit two events for the same underlying action. ----
  activityLogs.forEach((log) => {
    if (log.action === 'Customer Created' || log.action === 'Customer Deleted') return;
    if (log.action === 'Subscription Started' || log.action === 'Subscription Renewed') return;

    if (log.action === 'Customer Updated') {
      events.push({
        type: 'customer_updated',
        title: 'Customer Updated',
        description: log.description,
        createdAt: log.createdAt,
        performedBy: log.performedByName,
        metadata: {},
      });
      return;
    }

    if (log.action === 'Phone Number Changed') {
      const match = log.description?.match(PHONE_CHANGE_PATTERN);
      events.push({
        type: 'phone_changed',
        title: 'Phone Number Changed',
        description: log.description,
        createdAt: log.createdAt,
        performedBy: log.performedByName,
        metadata: match ? { oldPhone: match[1], newPhone: match[2] } : {},
      });
      return;
    }

    if (log.action === 'Device Added') {
      events.push({
        type: 'device_added',
        title: 'Device Added',
        description: log.description,
        createdAt: log.createdAt,
        performedBy: log.performedByName,
        metadata: {},
      });
      return;
    }

    if (log.action === 'Device Updated') {
      const match = log.description?.match(MAC_CHANGE_PATTERN);
      if (match && match[1] !== match[2]) {
        events.push({
          type: 'mac_changed',
          title: 'MAC Address Changed',
          description: log.description,
          createdAt: log.createdAt,
          performedBy: log.performedByName,
          metadata: { oldMac: match[1], newMac: match[2] },
        });
      } else {
        events.push({
          type: 'device_updated',
          title: 'Device Updated',
          description: log.description,
          createdAt: log.createdAt,
          performedBy: log.performedByName,
          metadata: {},
        });
      }
      return;
    }

    if (log.action === 'Device Removed') {
      events.push({
        type: 'device_removed',
        title: 'Device Removed',
        description: log.description,
        createdAt: log.createdAt,
        performedBy: log.performedByName,
        metadata: {},
      });
      return;
    }

    if (log.action === 'Panel Days Added') {
      events.push({
        type: 'panel_days_added',
        title: 'Panel Days Added',
        description: log.description,
        createdAt: log.createdAt,
        performedBy: log.performedByName,
        metadata: {},
      });
      return;
    }

    if (log.action === 'Follow-up Status Updated') {
      events.push({
        type: 'followup_status_changed',
        title: 'Follow-up Status Changed',
        description: log.description,
        createdAt: log.createdAt,
        performedBy: log.performedByName,
        metadata: {},
      });
      return;
    }

    if (log.action === 'Subscription Removed') {
      events.push({
        type: 'subscription_removed',
        title: 'Subscription Removed',
        description: log.description,
        createdAt: log.createdAt,
        performedBy: log.performedByName,
        metadata: {},
      });
      return;
    }

    // Unknown/future action types are still surfaced, generically, rather
    // than silently dropped.
    events.push({
      type: 'activity',
      title: log.action,
      description: log.description,
      createdAt: log.createdAt,
      performedBy: log.performedByName,
      metadata: {},
    });
  });

  // ---- Subscription lifecycle, derived directly from Subscription docs.
  // Exactly one event per subscription document: the first is a creation
  // (Trial Started / Subscription Created); every subsequent one is framed
  // by what actually changed versus the immediately preceding subscription
  // — Trial Converted, Plan Changed, Price Changed, or plain Renewed — so a
  // single renewal action never produces more than one timeline event. ----
  subscriptions.forEach((sub, index) => {
    if (index === 0) {
      const isTrial = sub.priceUSD === 0;
      const startedLog = findNearbyLog(activityLogs, 'Subscription Started', sub.createdAt);
      events.push({
        type: isTrial ? 'trial_started' : 'subscription_created',
        title: isTrial ? 'Trial Started' : 'Subscription Created',
        description: startedLog?.description || `${sub.plan} — $${sub.priceUSD}`,
        createdAt: sub.createdAt,
        performedBy: startedLog?.performedByName || null,
        metadata: { plan: sub.plan, priceUSD: sub.priceUSD, renewalDate: sub.renewalDate },
      });
      return;
    }

    const prev = subscriptions[index - 1];
    let type = 'subscription_renewed';
    let title = 'Subscription Renewed';

    if (prev.priceUSD === 0 && sub.priceUSD > 0) {
      type = 'trial_converted';
      title = 'Trial Converted';
    } else if (prev.plan !== sub.plan) {
      type = 'plan_changed';
      title = 'Plan Changed';
    } else if (prev.priceUSD !== sub.priceUSD) {
      type = 'price_changed';
      title = 'Price Changed';
    }

    const renewedLog = findNearbyLog(activityLogs, 'Subscription Renewed', sub.createdAt);
    events.push({
      type,
      title,
      description: renewedLog?.description || `${sub.plan} — $${sub.priceUSD}`,
      createdAt: sub.createdAt,
      performedBy: renewedLog?.performedByName || null,
      metadata: {
        plan: sub.plan,
        priceUSD: sub.priceUSD,
        previousPlan: prev.plan,
        previousPriceUSD: prev.priceUSD,
        renewalDate: sub.renewalDate,
      },
    });
  });

  // ---- Notes: one event per CustomerNote document ----
  notes.forEach((note) => {
    events.push({
      type: 'note_added',
      title: 'Note Added',
      description: note.note,
      createdAt: note.createdAt,
      performedBy: note.createdByName || null,
      metadata: {},
    });
  });

  events.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return events;
};

module.exports = { buildCustomerTimeline };
