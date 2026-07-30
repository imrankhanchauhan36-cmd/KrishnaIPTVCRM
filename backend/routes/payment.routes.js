const express = require('express');
const router = express.Router();
const {
  getAllPayments,
  getPaymentsByCustomer,
  createPayment,
  deletePayment,
} = require('../controllers/payment.controller');

router.get('/', getAllPayments);
router.get('/customer/:customerId', getPaymentsByCustomer);
router.post('/', createPayment);
router.delete('/:id', deletePayment);

module.exports = router;
