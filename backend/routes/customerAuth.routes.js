const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { requestOtp, verifyOtp, refresh, logout, getMe, markPwaInstalled } = require('../controllers/customerAuth.controller');

router.post('/login', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.patch('/me/mark-installed', protect, markPwaInstalled);

module.exports = router;
