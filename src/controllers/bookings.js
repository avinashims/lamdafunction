const { v4: uuidv4 } = require('uuid');
const { getPool, query } = require('../db/pool');

const BOOKING_STATUSES = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];

async function list(req, res, next) {
  try {
    const { guest_id, status } = req.query;
    let sql = `
      SELECT b.*,
        g.first_name AS guest_first_name, g.last_name AS guest_last_name, g.email AS guest_email,
        r.room_number, r.room_type
      FROM bookings b
      JOIN guests g ON g.id = b.guest_id
      JOIN rooms r ON r.id = b.room_id
      WHERE 1=1`;
    const params = [];
    if (guest_id) {
      sql += ' AND b.guest_id = ?';
      params.push(guest_id);
    }
    if (status) {
      sql += ' AND b.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY b.check_in DESC';
    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const rows = await query(
      `SELECT b.*,
        g.first_name AS guest_first_name, g.last_name AS guest_last_name,
        r.room_number, r.room_type, r.price_per_night
       FROM bookings b
       JOIN guests g ON g.id = b.guest_id
       JOIN rooms r ON r.id = b.room_id
       WHERE b.id = ?`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  const conn = await getPool().getConnection();
  try {
    const { guest_id, room_id, check_in, check_out, notes } = req.body;
    const checkIn = new Date(check_in);
    const checkOut = new Date(check_out);
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) {
      return res.status(400).json({
        success: false,
        error: 'Invalid dates: check_out must be after check_in',
      });
    }

    await conn.beginTransaction();

    const [guests] = await conn.execute('SELECT id FROM guests WHERE id = ?', [guest_id]);
    if (!guests.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Guest not found' });
    }

    const [rooms] = await conn.execute(
      'SELECT id, price_per_night, status FROM rooms WHERE id = ? FOR UPDATE',
      [room_id]
    );
    if (!rooms.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    if (rooms[0].status === 'maintenance') {
      await conn.rollback();
      return res.status(400).json({ success: false, error: 'Room is under maintenance' });
    }

    const [overlap] = await conn.execute(
      `SELECT id FROM bookings
       WHERE room_id = ? AND status NOT IN ('cancelled', 'checked_out')
         AND check_in < ? AND check_out > ?`,
      [room_id, check_out, check_in]
    );
    if (overlap.length) {
      await conn.rollback();
      return res.status(409).json({ success: false, error: 'Room not available for selected dates' });
    }

    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    const total_amount = Number(rooms[0].price_per_night) * nights;
    const id = uuidv4();

    await conn.execute(
      `INSERT INTO bookings (id, guest_id, room_id, check_in, check_out, total_amount, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [id, guest_id, room_id, check_in, check_out, total_amount, notes || null]
    );

    await conn.execute("UPDATE rooms SET status = 'reserved' WHERE id = ?", [room_id]);
    await conn.commit();

    const rows = await query('SELECT * FROM bookings WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

async function updateStatus(req, res, next) {
  const conn = await getPool().getConnection();
  try {
    const { status } = req.body;
    if (!BOOKING_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid booking status' });
    }

    await conn.beginTransaction();
    const [bookings] = await conn.execute(
      'SELECT id, room_id, status FROM bookings WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    if (!bookings.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const current = bookings[0];
    if (current.status === 'cancelled' || current.status === 'checked_out') {
      await conn.rollback();
      return res.status(400).json({ success: false, error: 'Cannot change terminal booking status' });
    }

    await conn.execute('UPDATE bookings SET status = ? WHERE id = ?', [status, req.params.id]);

    let roomStatus = 'reserved';
    if (status === 'checked_in') roomStatus = 'occupied';
    if (status === 'checked_out' || status === 'cancelled') roomStatus = 'available';
    if (status === 'confirmed' || status === 'pending') roomStatus = 'reserved';

    await conn.execute('UPDATE rooms SET status = ? WHERE id = ?', [roomStatus, current.room_id]);
    await conn.commit();

    const rows = await query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

async function cancel(req, res, next) {
  req.body = { status: 'cancelled' };
  return updateStatus(req, res, next);
}

module.exports = { list, getById, create, updateStatus, cancel };