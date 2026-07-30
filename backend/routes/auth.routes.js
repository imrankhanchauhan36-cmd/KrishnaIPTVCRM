const express = require('express');
const router = express.Router();
const { login, refresh, logout, logoutAllDevices } = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/logout-all', protect, logoutAllDevices);

module.exports = router;
