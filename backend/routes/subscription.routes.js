const express = require('express');
const router = express.Router();
const {
  getSubscriptionsByCustomer,
  createSubscription,
  updateSubscription,
  renewSubscription,
  addPanelDays,
  updateSubscriptionStatus,
  assignDevice,
  deleteSubscription,
} = require('../controllers/subscription.controller');

router.get('/customer/:customerId', getSubscriptionsByCustomer);
router.post('/', createSubscription);
router.post('/renew', renewSubscription);
router.post('/:id/add-panel-days', addPanelDays);
router.patch('/:id/status', updateSubscriptionStatus);
router.patch('/:id/device', assignDevice);
router.patch('/:id', updateSubscription);
router.delete('/:id', deleteSubscription);

module.exports = router;
