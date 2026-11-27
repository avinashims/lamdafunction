const express = require('express');
const { query } = require('../db/pool');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    await query('SELECT 1 AS ok');
    res.json({ success: true, status: 'healthy', database: 'connected' });
  } catch (err) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message,
    });
  }
});

module.exports = router;