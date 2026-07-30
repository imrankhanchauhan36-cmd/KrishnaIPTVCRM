const express = require('express');
const router = express.Router();
const { getDashboardStats, getTrialsByDate } = require('../controllers/dashboard.controller');

router.get('/stats', getDashboardStats);
router.get('/trials', getTrialsByDate);

module.exports = router;
