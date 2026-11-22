const { query } = require('../config/database');

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

async function listEmployees(req, res, next) {
  try {
    const activeOnly = req.query.active !== 'false';
    const sql = activeOnly
      ? 'SELECT * FROM employees WHERE is_active = 1 ORDER BY full_name'
      : 'SELECT * FROM employees ORDER BY full_name';
    const rows = await query(sql);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function getEmployee(req, res, next) {
  try {
    const rows = await query('SELECT * FROM employees WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function createEmployee(req, res, next) {
  try {
    const { employee_code, full_name, email, department } = req.body;
    if (!employee_code || !full_name) {
      throw badRequest('employee_code and full_name are required');
    }
    const result = await query(
      `INSERT INTO employees (employee_code, full_name, email, department)
       VALUES (?, ?, ?, ?)`,
      [employee_code, full_name, email || null, department || null]
    );
    const rows = await query('SELECT * FROM employees WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      err.statusCode = 409;
      err.message = 'Employee code or email already exists';
    }
    next(err);
  }
}

async function updateEmployee(req, res, next) {
  try {
    const { full_name, email, department, is_active } = req.body;
    const existing = await query('SELECT id FROM employees WHERE id = ?', [req.params.id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    await query(
      `UPDATE employees SET
        full_name = COALESCE(?, full_name),
        email = COALESCE(?, email),
        department = COALESCE(?, department),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        full_name ?? null,
        email ?? null,
        department ?? null,
        is_active === undefined ? null : is_active ? 1 : 0,
        req.params.id,
      ]
    );
    const rows = await query('SELECT * FROM employees WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function deleteEmployee(req, res, next) {
  try {
    const result = await query('UPDATE employees SET is_active = 0 WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    res.json({ success: true, message: 'Employee deactivated' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
};