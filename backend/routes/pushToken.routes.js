const express = require('express');
const router = express.Router();
const { registerToken, getTokensForCustomer, invalidateToken } = require('../controllers/pushToken.controller');

router.post('/', registerToken);
router.get('/customer/:customerId', getTokensForCustomer);
router.patch('/:id/invalidate', invalidateToken);

module.exports = router;
