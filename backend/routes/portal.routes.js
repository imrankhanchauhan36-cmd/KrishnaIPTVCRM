// portal routes
const express = require('express');
const router = express.Router();
const { getAllPortals, createPortal, updatePortal, deletePortal } = require('../controllers/portal.controller');

router.get('/', getAllPortals);
router.post('/', createPortal);
router.put('/:id', updatePortal);
router.delete('/:id', deletePortal);

module.exports = router;
