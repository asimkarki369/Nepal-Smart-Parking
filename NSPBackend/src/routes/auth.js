const router = require('express').Router();
const { body } = require('express-validator');
const crypto = require('crypto');
const pool = require('../db/pool');
const validate = require('../middleware/validate');
const { sendOTP } = require('../services/sms');
const { generateAccessToken, generateRefreshToken } = require('../services/token');

function generateOTP() {
  if (process.env.NODE_ENV !== 'production') return process.env.DEV_OTP || '123456';
  return crypto.randomInt(100000, 999999).toString();
}

// POST /auth/send-otp
router.post('/send-otp',
  body('phone').matches(/^(97|98)\d{8}$/).withMessage('Invalid Nepal mobile number.'),
  validate,
  async (req, res) => {
    const { phone } = req.body;
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES) || 10) * 60 * 1000);

    await pool.query(
      `INSERT INTO otps (phone, code, expires_at) VALUES ($1, $2, $3)`,
      [phone, otp, expiresAt]
    );

    await sendOTP(phone, otp);
    res.json({ message: 'OTP sent successfully.' });
  }
);

// POST /auth/verify-otp
router.post('/verify-otp',
  body('phone').matches(/^(97|98)\d{8}$/).withMessage('Invalid phone.'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits.'),
  validate,
  async (req, res) => {
    const { phone, otp } = req.body;

    const { rows } = await pool.query(
      `SELECT * FROM otps
       WHERE phone=$1 AND code=$2 AND used=FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [phone, otp]
    );

    if (!rows.length) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    await pool.query(`UPDATE otps SET used=TRUE WHERE id=$1`, [rows[0].id]);

    const existingUser = await pool.query(`SELECT * FROM users WHERE phone=$1`, [phone]);

    if (existingUser.rows.length) {
      const user = existingUser.rows[0];
      const token = generateAccessToken(user.id);
      const refreshToken = generateRefreshToken(user.id);
      await pool.query(`UPDATE users SET refresh_token=$1, updated_at=NOW() WHERE id=$2`, [refreshToken, user.id]);
      return res.json({
        token,
        refreshToken,
        isNewUser: false,
        user: {
          id: user.id,
          fullName: user.full_name,
          phone: user.phone,
          plateNumber: user.plate_number,
          vehicleType: user.vehicle_type,
          walletBalance: user.wallet_balance,
        },
      });
    }

    // New user — no user record yet, return token for registration step
    const tempToken = generateAccessToken(`temp_${phone}`);
    res.json({ token: tempToken, isNewUser: true });
  }
);

// POST /auth/register
router.post('/register',
  body('phone').matches(/^(97|98)\d{8}$/).withMessage('Invalid phone.'),
  body('fullName').trim().isLength({ min: 3 }).withMessage('Name too short.'),
  body('plateNumber').trim().isLength({ min: 4 }).withMessage('Invalid plate number.'),
  body('vehicleType').isIn(['2w', '4w']).withMessage('Vehicle type must be 2w or 4w.'),
  validate,
  async (req, res) => {
    const { phone, fullName, plateNumber, vehicleType } = req.body;

    const existing = await pool.query(`SELECT id FROM users WHERE phone=$1`, [phone]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Phone already registered.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO users (phone, full_name, plate_number, vehicle_type)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [phone, fullName, plateNumber.toUpperCase(), vehicleType]
    );

    const user = rows[0];
    const token = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);
    await pool.query(`UPDATE users SET refresh_token=$1 WHERE id=$2`, [refreshToken, user.id]);

    res.status(201).json({
      token,
      refreshToken,
      user: {
        id: user.id,
        fullName: user.full_name,
        phone: user.phone,
        plateNumber: user.plate_number,
        vehicleType: user.vehicle_type,
        walletBalance: user.wallet_balance,
      },
    });
  }
);

// POST /auth/logout
router.post('/logout', async (req, res) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    // Best-effort: clear refresh token if user is identifiable
  }
  res.json({ message: 'Logged out.' });
});

module.exports = router;
