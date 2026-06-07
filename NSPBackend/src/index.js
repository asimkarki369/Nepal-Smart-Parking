require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// Security
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
app.use('/v1/auth/send-otp', rateLimit({ windowMs: 10 * 60 * 1000, max: 5, message: { error: 'Too many OTP requests.' } }));
app.use('/v1/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// Routes
app.use('/v1/auth',     require('./routes/auth'));
app.use('/v1/zones',    require('./routes/zones'));
app.use('/v1/sessions', require('./routes/sessions'));
app.use('/v1/payments', require('./routes/payments'));
app.use('/v1/challans', require('./routes/challans'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`NSP API running on port ${PORT} [${process.env.NODE_ENV}]`));
