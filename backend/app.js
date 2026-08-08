const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Krishna IPTV Backend is running 🚀' });
});

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/customers', require('./routes/customer.routes'));
app.use('/api/devices', require('./routes/device.routes'));
app.use('/api/subscriptions', require('./routes/subscription.routes'));
app.use('/api/plans', require('./routes/plan.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/renewals', require('./routes/renewal.routes'));
app.use('/api/customer-notes', require('./routes/customerNote.routes'));
app.use('/api/employee-master', require('./routes/employeeMaster.routes'));
app.use('/api/portals', require('./routes/portal.routes'));

module.exports = app;
