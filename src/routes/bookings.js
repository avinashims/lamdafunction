const express = require('express');
const bookings = require('../controllers/bookings');
const { requireFields } = require('../middleware/validate');

const router = express.Router();

router.get('/', bookings.list);
router.get('/:id', bookings.getById);
router.post(
  '/',
  requireFields(['guest_id', 'room_id', 'check_in', 'check_out']),
  bookings.create
);
router.patch('/:id/status', requireFields(['status']), bookings.updateStatus);
router.delete('/:id', bookings.cancel);

module.exports = router;