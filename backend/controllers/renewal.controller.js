// renewal controller
const Customer = require('../models/Customer');
const Subscription = require('../models/Subscription');
const Device = require('../models/Device');

const BUCKETS = ['expiredToday', 'overdue', 'next7', 'next30', 'renewedToday'];

const getDateBounds = () => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const next7End = new Date(todayEnd);
  next7End.setDate(next7End.getDate() + 7);
  const next30End = new Date(todayEnd);
  next30End.setDate(next30End.getDate() + 30);
  return { todayStart, todayEnd, next7End, next30End };
};

// Parses a "YYYY-MM-DD" query param as a LOCAL calendar date (not UTC
// midnight, which new Date("YYYY-MM-DD") would give and could shift the
// date by a day depending on server timezone).
const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = String(dateStr).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Shared customer/device enrichment for every filter mode below (bucket,
// date, range) — kept in one place so they can never drift apart.
const buildRenewalResults = async (subscriptions) => {
  const customerIds = subscriptions.map((s) => s.customer);
  const customers = await Customer.find({ _id: { $in: customerIds }, isDeleted: false });
  const devices = await Device.find({ customer: { $in: customerIds } });

  const customerMap = {};
  customers.forEach((c) => {
    customerMap[c._id.toString()] = c;
  });

  const deviceMap = {};
  devices.forEach((d) => {
    const key = d.customer.toString();
    if (!deviceMap[key]) deviceMap[key] = d.macAddress;
  });

  return subscriptions
    .filter((s) => customerMap[s.customer.toString()])
    .map((s) => {
      const customer = customerMap[s.customer.toString()];
      return {
        subscriptionId: s._id,
        customerObjectId: customer._id,
        customerId: customer.customerId,
        fullName: customer.fullName,
        whatsappNumber: customer.whatsappNumber,
        email: customer.email,
        macAddress: deviceMap[s.customer.toString()] || null,
        plan: s.plan,
        priceUSD: s.priceUSD,
        renewalDate: s.renewalDate,
        panelExpiryDate: s.panelExpiryDate,
        employeeName: s.employeeName,
        trialStatus: s.trialStatus,
        followUpStatus: s.followUpStatus,
      };
    });
};

const fetchByBucket = async (bucket) => {
  const { todayStart, todayEnd, next7End, next30End } = getDateBounds();

  if (bucket === 'expiredToday') {
    return Subscription.find({
      status: 'Active',
      renewalDate: { $gte: todayStart, $lt: todayEnd },
    }).sort({ renewalDate: 1 });
  }
  if (bucket === 'overdue') {
    return Subscription.find({
      status: 'Active',
      renewalDate: { $lt: todayStart },
    }).sort({ renewalDate: 1 });
  }
  if (bucket === 'next7') {
    return Subscription.find({
      status: 'Active',
      renewalDate: { $gte: todayEnd, $lt: next7End },
    }).sort({ renewalDate: 1 });
  }
  if (bucket === 'next30') {
    return Subscription.find({
      status: 'Active',
      renewalDate: { $gte: todayEnd, $lt: next30End },
    }).sort({ renewalDate: 1 });
  }

  // renewedToday: an Active subscription created today, for a customer who
  // already had at least one other subscription record before it —
  // distinguishes "renewed/converted today" from "brand-new trial signed up
  // today", without needing a new field.
  const createdToday = await Subscription.find({
    status: 'Active',
    createdAt: { $gte: todayStart, $lt: todayEnd },
  }).sort({ createdAt: -1 });

  const customerIds = [...new Set(createdToday.map((s) => s.customer.toString()))];
  const allSubsForThoseCustomers = await Subscription.find(
    { customer: { $in: customerIds } },
    'customer'
  );

  const countByCustomer = {};
  allSubsForThoseCustomers.forEach((s) => {
    const key = s.customer.toString();
    countByCustomer[key] = (countByCustomer[key] || 0) + 1;
  });

  return createdToday.filter((s) => (countByCustomer[s.customer.toString()] || 0) > 1);
};

// GET /api/renewals
//   ?bucket=expiredToday|overdue|next7|next30|renewedToday   (unchanged)
//   ?date=YYYY-MM-DD                                          (new)
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD                             (new)
exports.getRenewalsByBucket = async (req, res) => {
  try {
    const { bucket, date, from, to } = req.query;

    let subscriptions;
    let meta = {};

    if (date) {
      const parsedDate = parseLocalDate(date);
      if (!parsedDate) {
        return res.status(400).json({ message: 'Invalid date. Use YYYY-MM-DD.' });
      }
      const dayStart = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      subscriptions = await Subscription.find({
        status: 'Active',
        renewalDate: { $gte: dayStart, $lt: dayEnd },
      }).sort({ renewalDate: 1 });
      meta = { date };
    } else if (from && to) {
      const parsedFrom = parseLocalDate(from);
      const parsedTo = parseLocalDate(to);
      if (!parsedFrom || !parsedTo) {
        return res.status(400).json({ message: 'Invalid from/to date. Use YYYY-MM-DD.' });
      }

      const rangeStart = new Date(parsedFrom.getFullYear(), parsedFrom.getMonth(), parsedFrom.getDate());
      const rangeEnd = new Date(parsedTo.getFullYear(), parsedTo.getMonth(), parsedTo.getDate());
      rangeEnd.setDate(rangeEnd.getDate() + 1); // inclusive of the "to" day

      if (rangeEnd <= rangeStart) {
        return res.status(400).json({ message: '"to" date must be on or after "from" date.' });
      }

      subscriptions = await Subscription.find({
        status: 'Active',
        renewalDate: { $gte: rangeStart, $lt: rangeEnd },
      }).sort({ renewalDate: 1 });
      meta = { from, to };
    } else if (bucket) {
      if (!BUCKETS.includes(bucket)) {
        return res.status(400).json({ message: `bucket must be one of: ${BUCKETS.join(', ')}` });
      }
      subscriptions = await fetchByBucket(bucket);
      meta = { bucket };
    } else {
      return res.status(400).json({ message: 'Provide bucket, date, or from and to.' });
    }

    const results = await buildRenewalResults(subscriptions);

    res.json({ ...meta, count: results.length, results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
