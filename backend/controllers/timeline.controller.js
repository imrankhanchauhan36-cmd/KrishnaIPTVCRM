const { buildCustomerTimeline } = require('../services/timeline.service');

// GET /api/customers/:id/timeline — read only
exports.getCustomerTimeline = async (req, res) => {
  try {
    const events = await buildCustomerTimeline(req.params.id);
    if (events === null) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
