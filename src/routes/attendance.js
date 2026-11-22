const express = require('express');
const {
  checkIn,
  checkOut,
  getAttendance,
  getAttendanceByEmployee,
  markAbsent,
  reportSummary,
} = require('../controllers/attendanceController');

const router = express.Router();

router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.post('/mark-absent', markAbsent);
router.get('/report', reportSummary);
router.get('/', getAttendance);
router.get('/employee/:employeeId', getAttendanceByEmployee);

module.exports = router;