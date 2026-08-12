const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { registerToken, getMyTokens, invalidateToken } = require('../controllers/staffPushToken.controller');

// Every staff-push-token operation requires a valid staff (Admin/Employee)
// JWT — identity for every write always comes from req.user, never the
// request body (see controller). Mirrors pushToken.routes.js's auth
// requirement, applied here from the start since this model is brand new.
router.post('/', protect, registerToken);
router.get('/me', protect, getMyTokens);
router.patch('/:id/invalidate', protect, invalidateToken);

module.exports = router;
