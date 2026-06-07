const router = require('express').Router();
const { body } = require('express-validator');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

// GET /challans/my
router.get('/my', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.*, z.name AS zone_name FROM challans c
     JOIN zones z ON c.zone_code = z.code
     WHERE c.user_id=$1 ORDER BY c.created_at DESC`,
    [req.user.userId]
  );
  res.json({
    challans: rows.map(c => ({
      id: c.id,
      zoneName: c.zone_name,
      zoneCode: c.zone_code,
      plateNumber: c.plate_number,
      fineAmount: c.fine_amount,
      reason: c.reason,
      status: c.status,
      issuedAt: c.created_at,
      paidAt: c.paid_at,
    })),
  });
});

// POST /challans/:id/pay
router.post('/:id/pay',
  auth,
  body('method').isIn(['esewa', 'khalti', 'connectips', 'wallet']).withMessage('Invalid method.'),
  validate,
  async (req, res) => {
    const { method } = req.body;
    const { rows } = await pool.query(
      `SELECT * FROM challans WHERE id=$1 AND user_id=$2 AND status='unpaid'`,
      [req.params.id, req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Unpaid challan not found.' });

    await pool.query(
      `UPDATE challans SET status='paid', paid_at=NOW() WHERE id=$1`,
      [req.params.id]
    );

    res.json({ message: 'Fine paid successfully.' });
  }
);

module.exports = router;
