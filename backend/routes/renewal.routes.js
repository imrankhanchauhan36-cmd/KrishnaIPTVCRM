// renewal routes
const express = require('express');
const router = express.Router();
const { getRenewalsByBucket } = require('../controllers/renewal.controller');

router.get('/', getRenewalsByBucket);

module.exports = router;
