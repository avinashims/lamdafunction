const { query } = require('../config/database');

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

async function ensureEmployee(employeeId) {
  const rows = await query(
    'SELECT id, full_name, employee_code FROM employees WHERE id = ? AND is_active = 1',
    [employeeId]
  );
  if (!rows.length) {
    const err = new Error('Active employee not found');
    err.statusCode = 404;
    throw err;
  }
  return rows[0];
}

async function checkIn(req, res, next) {
  try {
    const { employee_id, notes } = req.body;
    if (!employee_id) throw badRequest('employee_id is required');

    await ensureEmployee(employee_id);
    const date = todayDateString();
    const now = new Date();

    const existing = await query(
      'SELECT * FROM attendance WHERE employee_id = ? AND attendance_date = ?',
      [employee_id, date]
    );

    if (existing.length && existing[0].check_in) {
      throw badRequest('Already checked in for today');
    }

    if (existing.length) {
      await query(
        `UPDATE attendance SET check_in = ?, status = 'present', notes = COALESCE(?, notes) WHERE id = ?`,
        [now, notes || null, existing[0].id]
      );
    } else {
      await query(
        `INSERT INTO attendance (employee_id, attendance_date, check_in, status, notes)
         VALUES (?, ?, ?, 'present', ?)`,
        [employee_id, date, now, notes || null]
      );
    }

    const record = await query(
      `SELECT a.*, e.full_name, e.employee_code
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
       WHERE a.employee_id = ? AND a.attendance_date = ?`,
      [employee_id, date]
    );

    res.status(201).json({ success: true, data: record[0] });
  } catch (err) {
    next(err);
  }
}

async function checkOut(req, res, next) {
  try {
    const { employee_id, notes } = req.body;
    if (!employee_id) throw badRequest('employee_id is required');

    await ensureEmployee(employee_id);
    const date = todayDateString();
    const now = new Date();

    const existing = await query(
      'SELECT * FROM attendance WHERE employee_id = ? AND attendance_date = ?',
      [employee_id, date]
    );

    if (!existing.length || !existing[0].check_in) {
      throw badRequest('Must check in before check out');
    }
    if (existing[0].check_out) {
      throw badRequest('Already checked out for today');
    }

    await query(
      `UPDATE attendance SET check_out = ?, notes = COALESCE(?, notes) WHERE id = ?`,
      [now, notes || null, existing[0].id]
    );

    const record = await query(
      `SELECT a.*, e.full_name, e.employee_code
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
       WHERE a.id = ?`,
      [existing[0].id]
    );

    res.json({ success: true, data: record[0] });
  } catch (err) {
    next(err);
  }
}

async function markAbsent(req, res, next) {
  try {
    const { employee_id, attendance_date, notes } = req.body;
    if (!employee_id || !attendance_date) {
      throw badRequest('employee_id and attendance_date (YYYY-MM-DD) are required');
    }

    await ensureEmployee(employee_id);

    await query(
      `INSERT INTO attendance (employee_id, attendance_date, status, notes)
       VALUES (?, ?, 'absent', ?)
       ON DUPLICATE KEY UPDATE status = 'absent', notes = COALESCE(VALUES(notes), notes)`,
      [employee_id, attendance_date, notes || null]
    );

    const record = await query(
      `SELECT a.*, e.full_name, e.employee_code
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
       WHERE a.employee_id = ? AND a.attendance_date = ?`,
      [employee_id, attendance_date]
    );

    res.json({ success: true, data: record[0] });
  } catch (err) {
    next(err);
  }
}

async function getAttendance(req, res, next) {
  try {
    const { from, to, status } = req.query;
    const conditions = [];
    const params = [];

    if (from) {
      conditions.push('a.attendance_date >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('a.attendance_date <= ?');
      params.push(to);
    }
    if (status) {
      conditions.push('a.status = ?');
      params.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await query(
      `SELECT a.*, e.full_name, e.employee_code, e.department
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
       ${where}
       ORDER BY a.attendance_date DESC, e.full_name`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function getAttendanceByEmployee(req, res, next) {
  try {
    const { from, to } = req.query;
    const employeeId = req.params.employeeId;
    await ensureEmployee(employeeId);

    const conditions = ['a.employee_id = ?'];
    const params = [employeeId];

    if (from) {
      conditions.push('a.attendance_date >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('a.attendance_date <= ?');
      params.push(to);
    }

    const rows = await query(
      `SELECT a.*, e.full_name, e.employee_code
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.attendance_date DESC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function reportSummary(req, res, next) {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      throw badRequest('from and to query params (YYYY-MM-DD) are required');
    }

    const rows = await query(
      `SELECT
        e.id AS employee_id,
        e.employee_code,
        e.full_name,
        e.department,
        SUM(a.status = 'present') AS present_days,
        SUM(a.status = 'absent') AS absent_days,
        SUM(a.status = 'half_day') AS half_days,
        SUM(a.status = 'leave') AS leave_days,
        COUNT(a.id) AS total_records
       FROM employees e
       LEFT JOIN attendance a
         ON a.employee_id = e.id
         AND a.attendance_date BETWEEN ? AND ?
       WHERE e.is_active = 1
       GROUP BY e.id, e.employee_code, e.full_name, e.department
       ORDER BY e.full_name`,
      [from, to]
    );

    res.json({ success: true, data: rows, period: { from, to } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  checkIn,
  checkOut,
  getAttendance,
  getAttendanceByEmployee,
  markAbsent,
  reportSummary,
};