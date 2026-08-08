const CustomerNote = require('../models/CustomerNote');

// GET /api/customer-notes/customer/:customerId
exports.getNotesByCustomer = async (req, res) => {
  try {
    const notes = await CustomerNote.find({ customer: req.params.customerId }).sort({ createdAt: -1 });
    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/customer-notes
exports.createNote = async (req, res) => {
  try {
    const { customer, note } = req.body;
    if (!customer || !note || !note.trim()) {
      return res.status(400).json({ message: 'Customer and note text are required' });
    }

    const newNote = await CustomerNote.create({
      customer,
      note: note.trim(),
      createdByName: req.user?.fullName || 'Owner',
      createdByType: req.user?.userType || 'Admin',
    });

    res.status(201).json(newNote);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
