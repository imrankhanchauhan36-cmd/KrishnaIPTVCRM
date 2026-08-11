// Scheduled jobs (renewal checks, reminders)
//
// Idempotent by construction: every candidate subscription is re-evaluated
// on every sweep, and notification.service.raiseEvent's idempotencyKey
// (subscriptionId + reminder stage + channel) silently no-ops for anything
// already sent. The scheduler itself keeps no "have I already sent this"
// state — the Notification collection's unique index is the single source
// of truth, so running this sweep twice (or twice concurrently) can never
// produce a duplicate reminder.
const Subscription = require('../models/Subscription');
const Customer = require('../models/Customer');
const Device = require('../models/Device');
const { raiseEvent, runRetrySweep } = require('../services/notification.service');
const { getBusinessTodayStart, addDays } = require('../utils/timezone.util');
const { EVENT_TYPES, REMINDER_OFFSETS_DAYS, REMINDER_STAGE } = require('../constants/notification.constants');

const buildVariables = (customer, subscription, device) => ({
  customerName: customer.fullName,
  subscriptionPlan: subscription.plan,
  renewalDate: new Date(subscription.renewalDate).toDateString(),
  expiryDate: new Date(subscription.renewalDate).toDateString(),
  panelAddedDays: subscription.panelAddedDays,
  deviceName: device ? device.deviceName || device.deviceType : undefined,
  macAddress: device ? device.macAddress : undefined,
});

const raiseForSubscriptions = async (subscriptions, eventType, stage) => {
  if (subscriptions.length === 0) return 0;

  const customerIds = subscriptions.map((s) => s.customer);
  const customers = await Customer.find({ _id: { $in: customerIds }, isDeleted: false }).lean();
  const customerMap = new Map(customers.map((c) => [c._id.toString(), c]));

  const deviceIds = subscriptions.filter((s) => s.device).map((s) => s.device);
  const devices = deviceIds.length ? await Device.find({ _id: { $in: deviceIds } }).lean() : [];
  const deviceMap = new Map(devices.map((d) => [d._id.toString(), d]));

  let count = 0;
  for (const subscription of subscriptions) {
    const customer = customerMap.get(subscription.customer.toString());
    if (!customer) continue; // soft-deleted or missing customer — skip, never fabricate a recipient

    const device = subscription.device ? deviceMap.get(subscription.device.toString()) : null;

    try {
      await raiseEvent({
        eventType,
        customer: customer._id,
        subscription: subscription._id,
        entityId: String(subscription._id),
        extra: stage,
        variables: buildVariables(customer, subscription, device),
        metadata: { reminderStage: stage },
      });
      count += 1;
    } catch (error) {
      // One bad record must never abort the whole sweep.
      console.error(`[ReminderJob] Failed to raise ${eventType}/${stage} for subscription ${subscription._id}:`, error.message);
    }
  }
  return count;
};

// Runs the full D-7/D-3/D-1/D-Day/Expired reminder sweep plus the retry
// sweep for anything still PENDING. The reminder logic itself is unchanged
// from before — only the wrapper below (overlap protection) is new.
const runReminderSweepInternal = async () => {
  const todayStart = getBusinessTodayStart();
  const summary = { expiring: 0, expired: 0, retriesProcessed: 0 };

  for (const { stage, offsetDays } of REMINDER_OFFSETS_DAYS) {
    const dayStart = addDays(todayStart, offsetDays);
    const dayEnd = addDays(dayStart, 1);

    const subscriptions = await Subscription.find({
      status: 'Active',
      renewalDate: { $gte: dayStart, $lt: dayEnd },
    });

    summary.expiring += await raiseForSubscriptions(subscriptions, EVENT_TYPES.SUBSCRIPTION_EXPIRING, stage);
  }

  // "Expired follow-up": Active subscriptions whose renewalDate has already
  // passed (the existing Renewal Command Center's "overdue" bucket) — fired
  // once per subscription via the idempotency key, not repeated daily.
  const overdueSubscriptions = await Subscription.find({
    status: 'Active',
    renewalDate: { $lt: todayStart },
  });
  summary.expired = await raiseForSubscriptions(overdueSubscriptions, EVENT_TYPES.SUBSCRIPTION_EXPIRED, REMINDER_STAGE.EXPIRED);

  summary.retriesProcessed = await runRetrySweep();

  return summary;
};

// Overlap protection: an in-process lock so two concurrent invocations
// (an admin manually triggering it while the periodic timer also fires, or
// two admin clicks in quick succession) never run the sweep's DB scan
// twice at once. This is defense in depth, not the correctness guarantee —
// the Notification collection's unique idempotencyKey index is still what
// actually prevents a duplicate notification from ever being written, even
// if this lock were somehow bypassed (e.g. a second process).
let sweepInProgress = false;

const runReminderSweep = async () => {
  if (sweepInProgress) {
    console.log('[ReminderJob] Sweep already in progress — this invocation was skipped, not run concurrently.');
    return { skipped: true, reason: 'A sweep is already running' };
  }
  sweepInProgress = true;
  try {
    return await runReminderSweepInternal();
  } finally {
    sweepInProgress = false;
  }
};

const isSweepRunning = () => sweepInProgress;

module.exports = { runReminderSweep, isSweepRunning };
