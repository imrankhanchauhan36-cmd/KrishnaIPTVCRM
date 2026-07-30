const Plan = require('../models/Plan');

exports.getAllPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ durationType: 1, durationValue: 1 });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createPlan = async (req, res) => {
  try {
    const { name, durationType, durationValue, priceUSD, description } = req.body;
    if (!name || !durationType || !durationValue || priceUSD === undefined) {
      return res.status(400).json({ message: 'Name, duration type, duration value, and price are required' });
    }
    const plan = new Plan({ name, durationType, durationValue, priceUSD, description });
    const saved = await plan.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const updated = await Plan.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ message: 'Plan not found' });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    const updated = await Plan.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!updated) return res.status(404).json({ message: 'Plan not found' });
    res.json({ message: 'Plan removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
