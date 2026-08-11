const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const { logActivity } = require('../services/activityLog.service');
const { safeRaiseEvent } = require('../services/notification.service');
const { EVENT_TYPES } = require('../constants/notification.constants');

// GET all payments (with customer info attached), newest first
exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find().sort({ transactionDate: -1 }).lean();
    const customerIds = payments.map((p) => p.customer);
    const customers = await Customer.find({ _id: { $in: customerIds } }).lean();

    const customerMap = {};
    customers.forEach((c) => {
      customerMap[c._id.toString()] = c;
    });

    const enriched = payments.map((p) => ({
      ...p,
      customerName: customerMap[p.customer.toString()]?.fullName || 'Unknown',
      customerIdCode: customerMap[p.customer.toString()]?.customerId || '',
      whatsappNumber: customerMap[p.customer.toString()]?.whatsappNumber || '',
    }));

    const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    res.json({ payments: enriched, totalRevenue });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET payments for a specific customer
exports.getPaymentsByCustomer = async (req, res) => {
  try {
    const payments = await Payment.find({ customer: req.params.customerId }).sort({
      transactionDate: -1,
    });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// CREATE a payment record
exports.createPayment = async (req, res) => {
  try {
    const { customer, subscription, amount, currency, paymentMethod, receivedBy, transactionDate, notes } =
      req.body;

    if (!customer || !amount) {
      return res.status(400).json({ message: 'Customer and amount are required' });
    }

    const payment = new Payment({
      customer,
      subscription,
      amount: Number(amount),
      currency: currency || 'USD',
      paymentMethod: paymentMethod || 'Cash',
      receivedBy,
      transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
      notes,
    });
    const saved = await payment.save();

    await logActivity({
      customer,
      action: 'Payment Received',
      description: `Received $${amount} via ${paymentMethod || 'Cash'}`,
      performedByName: req.user?.fullName || 'Owner',
      performedByType: req.user?.userType || 'Admin',
    });

    const customerDoc = await Customer.findById(customer).select('fullName').lean();
    await safeRaiseEvent({
      eventType: EVENT_TYPES.PAYMENT_SUCCESS,
      customer,
      subscription: subscription || undefined,
      entityId: String(saved._id),
      variables: {
        customerName: customerDoc?.fullName,
        amount: `$${amount}`,
      },
    });

    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// DELETE a payment record
exports.deletePayment = async (req, res) => {
  try {
    const deleted = await Payment.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Payment not found' });

    await logActivity({
      customer: deleted.customer,
      action: 'Payment Removed',
      description: `Removed a $${deleted.amount} payment record`,
      performedByName: req.user?.fullName || 'Owner',
      performedByType: req.user?.userType || 'Admin',
    });

    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
