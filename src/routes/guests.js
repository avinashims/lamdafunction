const express = require('express');
const guests = require('../controllers/guests');
const { requireFields } = require('../middleware/validate');

const router = express.Router();

router.get('/', guests.list);
router.get('/:id', guests.getById);
router.post(
  '/',
  requireFields(['first_name', 'last_name', 'email']),
  guests.create
);
router.put('/:id', guests.update);
router.delete('/:id', guests.remove);

module.exports = router;