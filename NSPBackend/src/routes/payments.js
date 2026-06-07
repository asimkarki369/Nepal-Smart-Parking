const router = require('express').Router();
const { body } = require('express-validator');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

// POST /payments/initiate
router.post('/initiate',
  auth,
  body('amount').isInt({ min: 10 }).withMessage('Amount must be at least Rs 10.'),
  body('method').isIn(['esewa', 'khalti', 'connectips']).withMessage('Invalid payment method.'),
  validate,
  async (req, res) => {
    const { amount, method, sessionId } = req.body;
    const userId = req.user.userId;

    const { rows } = await pool.query(
      `INSERT INTO payments (user_id, session_id, amount, method, type, status)
       VALUES ($1,$2,$3,$4,'topup','pending') RETURNING id`,
      [userId, sessionId || null, amount, method]
    );

    // In production: redirect to eSewa/Khalti payment URL
    // For now: return a mock payment URL
    const paymentId = rows[0].id;
    res.json({
      paymentId,
      redirectUrl: `https://payment.example.com/${method}?amount=${amount}&ref=${paymentId}`,
      message: `Redirect user to ${method} for payment.`,
    });
  }
);

// GET /payments/verify/:transactionId
router.get('/verify/:transactionId', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM payments WHERE transaction_ref=$1 AND user_id=$2`,
    [req.params.transactionId, req.user.userId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Payment not found.' });
  res.json({ status: rows[0].status, amount: rows[0].amount });
});

// GET /payments/wallet/balance
router.get('/wallet/balance', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT wallet_balance FROM users WHERE id=$1`,
    [req.user.userId]
  );
  res.json({ balance: rows[0]?.wallet_balance ?? 0 });
});

// POST /payments/wallet/topup
router.post('/wallet/topup',
  auth,
  body('amount').isInt({ min: 10, max: 100000 }).withMessage('Amount must be Rs 10–100,000.'),
  body('method').isIn(['esewa', 'khalti', 'connectips']).withMessage('Invalid method.'),
  validate,
  async (req, res) => {
    const { amount, method } = req.body;
    const userId = req.user.userId;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE users SET wallet_balance = wallet_balance + $1, updated_at=NOW() WHERE id=$2`,
        [amount, userId]
      );
      await client.query(
        `INSERT INTO payments (user_id, amount, method, type, status, transaction_ref)
         VALUES ($1,$2,$3,'topup','completed',$4)`,
        [userId, amount, method, `TOPUP-${Date.now()}`]
      );

      await client.query('COMMIT');

      const balRes = await pool.query(`SELECT wallet_balance FROM users WHERE id=$1`, [userId]);
      res.json({ message: 'Wallet topped up.', newBalance: balRes.rows[0].wallet_balance });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
);

module.exports = router;
