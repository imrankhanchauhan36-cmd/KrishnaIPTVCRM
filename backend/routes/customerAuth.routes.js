const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { requestOtp, verifyOtp, refresh, logout, getMe } = require('../controllers/customerAuth.controller');

router.post('/login', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', protect, getMe);

module.exports = router;
