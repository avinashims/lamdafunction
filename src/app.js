const express = require('express');
const cors = require('cors');
const employeesRouter = require('./routes/employees');
const attendanceRouter = require('./routes/attendance');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', async (req, res) => {
  res.json({ success: true, service: 'attendance-management-api' });
});

app.use('/api/employees', employeesRouter);
app.use('/api/attendance', attendanceRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;