const express = require('express');
const router = express.Router();
const {
  getDevicesByCustomer,
  createDevice,
  updateDevice,
  deleteDevice,
} = require('../controllers/device.controller');

router.get('/customer/:customerId', getDevicesByCustomer);
router.post('/', createDevice);
router.put('/:id', updateDevice);
router.delete('/:id', deleteDevice);

module.exports = router;
