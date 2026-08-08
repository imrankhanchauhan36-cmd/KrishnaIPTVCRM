const express = require('express');
const router = express.Router();
const { getNotesByCustomer, createNote } = require('../controllers/customerNote.controller');

router.get('/customer/:customerId', getNotesByCustomer);
router.post('/', createNote);

module.exports = router;
