const express = require('express');
const router = express.Router();
const {
  getAllCustomers,
  getCustomerById,
  checkDuplicate,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} = require('../controllers/customer.controller');

router.post('/check-duplicate', checkDuplicate);
router.get('/', getAllCustomers);
router.get('/:id', getCustomerById);
router.post('/', createCustomer);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

module.exports = router;
