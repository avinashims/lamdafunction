if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const guestsRouter = require('./routes/guests');
const roomsRouter = require('./routes/rooms');
const bookingsRouter = require('./routes/bookings');
const healthRouter = require('./routes/health');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/health', healthRouter);
app.use('/api/guests', guestsRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/bookings', bookingsRouter);

app.get('/', (req, res) => {
  res.json({
    name: 'Hotel Management API',
    version: '1.0.0',
    docs: {
      guests: '/api/guests',
      rooms: '/api/rooms',
      bookings: '/api/bookings',
      health: '/health',
    },
  });
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;