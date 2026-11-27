const { v4: uuidv4 } = require('uuid');
const { query } = require('../db/pool');

const VALID_STATUSES = ['available', 'occupied', 'maintenance', 'reserved'];

async function list(req, res, next) {
  try {
    const rows = await query(
      `SELECT id, room_number, room_type, floor, price_per_night, status, capacity, amenities, created_at
       FROM rooms ORDER BY room_number`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function listAvailable(req, res, next) {
  try {
    const { check_in, check_out } = req.query;
    if (!check_in || !check_out) {
      return res.status(400).json({
        success: false,
        error: 'Query params check_in and check_out are required (YYYY-MM-DD)',
      });
    }
    const rows = await query(
      `SELECT r.* FROM rooms r
       WHERE r.status != 'maintenance'
         AND r.id NOT IN (
           SELECT room_id FROM bookings
           WHERE status NOT IN ('cancelled', 'checked_out')
             AND check_in < ? AND check_out > ?
         )
       ORDER BY r.room_number`,
      [check_out, check_in]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const rows = await query('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const id = uuidv4();
    const {
      room_number,
      room_type,
      floor,
      price_per_night,
      capacity,
      amenities,
      status,
    } = req.body;
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid room status' });
    }
    await query(
      `INSERT INTO rooms (id, room_number, room_type, floor, price_per_night, capacity, amenities, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        room_number,
        room_type,
        floor ?? null,
        price_per_night,
        capacity ?? 2,
        amenities ? JSON.stringify(amenities) : null,
        status || 'available',
      ]
    );
    const rows = await query('SELECT * FROM rooms WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Room number already exists' });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { status } = req.body;
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid room status' });
    }
    const b = req.body;
    const result = await query(
      `UPDATE rooms SET
         room_number = COALESCE(?, room_number),
         room_type = COALESCE(?, room_type),
         floor = COALESCE(?, floor),
         price_per_night = COALESCE(?, price_per_night),
         capacity = COALESCE(?, capacity),
         status = COALESCE(?, status),
         amenities = COALESCE(?, amenities)
       WHERE id = ?`,
      [
        b.room_number ?? null,
        b.room_type ?? null,
        b.floor ?? null,
        b.price_per_night ?? null,
        b.capacity ?? null,
        b.status ?? null,
        b.amenities != null ? JSON.stringify(b.amenities) : null,
        req.params.id,
      ]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    const rows = await query('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const active = await query(
      `SELECT id FROM bookings WHERE room_id = ? AND status IN ('pending','confirmed','checked_in') LIMIT 1`,
      [req.params.id]
    );
    if (active.length) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete room with active bookings',
      });
    }
    const result = await query('DELETE FROM rooms WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    res.json({ success: true, message: 'Room deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, listAvailable, getById, create, update, remove };