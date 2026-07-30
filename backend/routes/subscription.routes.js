const express = require('express');
const router = express.Router();
const {
  getSubscriptionsByCustomer,
  createSubscription,
  renewSubscription,
  addPanelDays,
  deleteSubscription,
} = require('../controllers/subscription.controller');

router.get('/customer/:customerId', getSubscriptionsByCustomer);
router.post('/', createSubscription);
router.post('/renew', renewSubscription);
router.post('/:id/add-panel-days', addPanelDays);
router.delete('/:id', deleteSubscription);

module.exports = router;
