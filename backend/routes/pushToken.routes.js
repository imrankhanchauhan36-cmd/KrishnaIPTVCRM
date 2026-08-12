const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const {
  registerToken,
  getTokensForCustomer,
  invalidateToken,
  registerMyToken,
  getMyTokens,
  invalidateMyToken,
} = require('../controllers/pushToken.controller');

// Every push-token operation requires a valid staff (Admin/Employee) JWT —
// these were unauthenticated in the Notification Engine V1 scaffolding,
// which was acceptable while the model was inert (no adapter ever read
// from it). Now that PUSH is a real, working channel, an unauthenticated
// write here could silently redirect a real customer's push notifications
// to an attacker-controlled device, so this is tightened rather than left
// matching the rest of the (customer-scoped-by-ID, unauthenticated)
// notification API. Uses the exact same `protect` middleware already
// established for the notification admin routes — no second auth system.
router.post('/', protect, registerToken);
router.get('/customer/:customerId', protect, getTokensForCustomer);
router.patch('/:id/invalidate', protect, invalidateToken);

// Customer self-service (User App) — identity from JWT only, see controller.
router.post('/me', protect, registerMyToken);
router.get('/me', protect, getMyTokens);
router.patch('/me/:id/invalidate', protect, invalidateMyToken);

module.exports = router;
