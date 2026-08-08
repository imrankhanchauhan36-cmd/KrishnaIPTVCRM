const EmployeeMaster = require('../models/EmployeeMaster');

// GET /api/employee-master            -> active only (dropdown consumers)
// GET /api/employee-master?all=true   -> everyone, including inactive (management screen)
exports.getAllEmployees = async (req, res) => {
  try {
    const filter = req.query.all === 'true' ? {} : { isActive: true };
    const employees = await EmployeeMaster.find(filter).sort({ employeeName: 1 });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createEmployee = async (req, res) => {
  try {
    const { employeeName } = req.body;
    if (!employeeName || !employeeName.trim()) {
      return res.status(400).json({ message: 'Employee name is required' });
    }
    const employee = new EmployeeMaster({ employeeName: employeeName.trim() });
    const saved = await employee.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const updated = await EmployeeMaster.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ message: 'Employee not found' });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Soft delete only — matches Plan's existing pattern exactly. Never hard
// deletes, so any subscription already referencing this employee by ID
// keeps resolving correctly.
exports.deleteEmployee = async (req, res) => {
  try {
    const updated = await EmployeeMaster.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!updated) return res.status(404).json({ message: 'Employee not found' });
    res.json({ message: 'Employee removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
