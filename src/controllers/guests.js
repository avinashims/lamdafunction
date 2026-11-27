const { v4: uuidv4 } = require('uuid');
const { query } = require('../db/pool');

async function list(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const rows = await query(
      `SELECT id, first_name, last_name, email, phone, created_at
       FROM guests ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const rows = await query('SELECT * FROM guests WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Guest not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const id = uuidv4();
    const { first_name, last_name, email, phone } = req.body;
    await query(
      `INSERT INTO guests (id, first_name, last_name, email, phone)
       VALUES (?, ?, ?, ?, ?)`,
      [id, first_name, last_name, email, phone || null]
    );
    const rows = await query('SELECT * FROM guests WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { first_name, last_name, email, phone } = req.body;
    const result = await query(
      `UPDATE guests SET
         first_name = COALESCE(?, first_name),
         last_name = COALESCE(?, last_name),
         email = COALESCE(?, email),
         phone = COALESCE(?, phone)
       WHERE id = ?`,
      [first_name ?? null, last_name ?? null, email ?? null, phone ?? null, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Guest not found' });
    }
    const rows = await query('SELECT * FROM guests WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const active = await query(
      `SELECT id FROM bookings WHERE guest_id = ? AND status IN ('pending','confirmed','checked_in') LIMIT 1`,
      [req.params.id]
    );
    if (active.length) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete guest with active bookings',
      });
    }
    const result = await query('DELETE FROM guests WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Guest not found' });
    }
    res.json({ success: true, message: 'Guest deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, update, remove };