const express = require('express');
const router = express.Router();
const { getAllPlans, createPlan, updatePlan, deletePlan } = require('../controllers/plan.controller');

router.get('/', getAllPlans);
router.post('/', createPlan);
router.put('/:id', updatePlan);
router.delete('/:id', deletePlan);

module.exports = router;
