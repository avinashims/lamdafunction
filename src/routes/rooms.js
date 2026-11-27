const express = require('express');
const rooms = require('../controllers/rooms');
const { requireFields } = require('../middleware/validate');

const router = express.Router();

router.get('/', rooms.list);
router.get('/available', rooms.listAvailable);
router.get('/:id', rooms.getById);
router.post(
  '/',
  requireFields(['room_number', 'room_type', 'price_per_night']),
  rooms.create
);
router.put('/:id', rooms.update);
router.delete('/:id', rooms.remove);

module.exports = router;