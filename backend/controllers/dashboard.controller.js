const Customer = require('../models/Customer');
const Subscription = require('../models/Subscription');
const Device = require('../models/Device');

exports.getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const tomorrowStart = new Date(todayEnd);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    const next7Start = new Date(todayStart);
    const next7End = new Date(todayStart);
    next7End.setDate(next7End.getDate() + 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [
      activeCustomers,
      expiredCustomers,
      todaysRenewals,
      tomorrowsRenewals,
      next7DaysRenewals,
      monthlySubscriptions,
      totalCustomers,
      pwaInstalledCustomers,
    ] = await Promise.all([
      Customer.countDocuments({ status: 'Active', isDeleted: false }),
      Customer.countDocuments({ status: 'Expired', isDeleted: false }),
      Subscription.countDocuments({
        status: 'Active',
        renewalDate: { $gte: todayStart, $lt: todayEnd },
      }),
      Subscription.countDocuments({
        status: 'Active',
        renewalDate: { $gte: tomorrowStart, $lt: tomorrowEnd },
      }),
      Subscription.countDocuments({
        status: 'Active',
        renewalDate: { $gte: next7Start, $lt: next7End },
      }),
      Subscription.find({
        startingDate: { $gte: monthStart, $lt: monthEnd },
      }),
      Customer.countDocuments({ isDeleted: false }),
      Customer.countDocuments({ isDeleted: false, pwaInstalledAt: { $ne: null } }),
    ]);

    const monthlyRevenue = monthlySubscriptions.reduce((sum, s) => sum + (s.priceUSD || 0), 0);

    res.json({
      todaysRenewals,
      tomorrowsRenewals,
      next7DaysRenewals,
      expiredCustomers,
      activeCustomers,
      monthlyRevenue,
      pendingPayments: 0,
      totalCustomers,
      pwaInstalledCustomers,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/dashboard/trials?date=YYYY-MM-DD (defaults to today) or ?all=true for all trials
exports.getTrialsByDate = async (req, res) => {
  try {
    let query = { priceUSD: 0 };

    if (req.query.all !== 'true') {
      const dateParam = req.query.date ? new Date(req.query.date) : new Date();
      const dayStart = new Date(dateParam.getFullYear(), dateParam.getMonth(), dateParam.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      query.startingDate = { $gte: dayStart, $lt: dayEnd };
    }

    const trialSubscriptions = await Subscription.find(query).sort({ createdAt: -1 });

    const customerIds = trialSubscriptions.map((s) => s.customer);
    const customers = await Customer.find({ _id: { $in: customerIds } });
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

    const results = trialSubscriptions.map((s) => {
      const customer = customerMap[s.customer.toString()];
      return {
        subscriptionId: s._id,
        customerId: customer?._id,
        // Additive aliases (customerId above is the Mongo _id, kept as-is
        // for backward compatibility) — customerObjectId/customerCode make
        // the two unambiguous for screens that need to open a customer's
        // profile (which needs the real _id) and show their readable ID.
        customerObjectId: customer?._id,
        customerCode: customer?.customerId,
        fullName: customer?.fullName,
        whatsappNumber: customer?.whatsappNumber,
        email: customer?.email,
        macAddress: deviceMap[s.customer.toString()] || null,
        plan: s.plan,
        startingDate: s.startingDate,
        panelExpiryDate: s.panelExpiryDate,
        status: s.status,
        trialStatus: s.trialStatus,
        followUpStatus: s.followUpStatus,
      };
    });

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
