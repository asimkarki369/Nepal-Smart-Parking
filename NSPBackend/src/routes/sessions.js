const router = require('express').Router();
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

// POST /sessions/start
router.post('/start',
  auth,
  body('zoneCode').notEmpty().withMessage('zoneCode is required.'),
  body('vehicleType').isIn(['2w', '4w']).withMessage('vehicleType must be 2w or 4w.'),
  body('durationMinutes').isInt({ min: 15, max: 720 }).withMessage('Duration must be 15–720 minutes.'),
  body('paymentMethod').isIn(['esewa', 'khalti', 'connectips', 'wallet']).withMessage('Invalid payment method.'),
  validate,
  async (req, res) => {
    const { zoneCode, vehicleType, durationMinutes, paymentMethod } = req.body;
    const userId = req.user.userId;

    const zoneRes = await pool.query(`SELECT * FROM zones WHERE code=$1 AND is_active=TRUE`, [zoneCode]);
    if (!zoneRes.rows.length) return res.status(404).json({ error: 'Zone not found.' });
    const zone = zoneRes.rows[0];

    if (zone.available_spots <= 0) return res.status(409).json({ error: 'Zone is full.' });

    const hourlyRate = vehicleType === '4w' ? zone.rate_4w : zone.rate_2w;
    const fee = Math.round((hourlyRate * durationMinutes) / 60);
    const serviceFee = Math.round(fee * 0.1);
    const totalPaid = fee + serviceFee;

    const qrToken = `QR-${zoneCode}-${uuidv4().slice(0, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const sessionRes = await client.query(
        `INSERT INTO sessions
           (user_id, zone_code, vehicle_type, duration_minutes, fee, service_fee, total_paid, payment_method, qr_token, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [userId, zoneCode, vehicleType, durationMinutes, fee, serviceFee, totalPaid, paymentMethod, qrToken, expiresAt]
      );

      await client.query(
        `UPDATE zones SET available_spots = available_spots - 1 WHERE code=$1`,
        [zoneCode]
      );

      await client.query(
        `INSERT INTO payments (user_id, session_id, amount, method, type, status, transaction_ref)
         VALUES ($1,$2,$3,$4,'parking','completed',$5)`,
        [userId, sessionRes.rows[0].id, totalPaid, paymentMethod, `TXN-${Date.now()}`]
      );

      await client.query('COMMIT');

      const s = sessionRes.rows[0];
      res.status(201).json({
        session: {
          sessionId: s.id,
          zoneCode: s.zone_code,
          zoneName: zone.name,
          zoneLocation: `${zone.city}, Nepal`,
          startTime: s.started_at,
          expiresAt: s.expires_at,
          durationMinutes: s.duration_minutes,
          fee: s.fee,
          serviceFee: s.service_fee,
          totalPaid: s.total_paid,
          vehicleType: s.vehicle_type,
          paymentMethod: s.payment_method,
          qrToken: s.qr_token,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
);

// GET /sessions/active
router.get('/active', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.*, z.name AS zone_name, z.city
     FROM sessions s JOIN zones z ON s.zone_code = z.code
     WHERE s.user_id=$1 AND s.status='active'
     ORDER BY s.started_at DESC LIMIT 1`,
    [req.user.userId]
  );
  if (!rows.length) return res.json({ session: null });
  res.json({ session: formatSession(rows[0]) });
});

// POST /sessions/:id/extend
router.post('/:id/extend',
  auth,
  body('additionalMinutes').isInt({ min: 15 }).withMessage('additionalMinutes must be at least 15.'),
  validate,
  async (req, res) => {
    const { additionalMinutes } = req.body;
    const { rows } = await pool.query(
      `SELECT s.*, z.rate_4w, z.rate_2w FROM sessions s JOIN zones z ON s.zone_code=z.code
       WHERE s.id=$1 AND s.user_id=$2 AND s.status='active'`,
      [req.params.id, req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Active session not found.' });
    const s = rows[0];

    const hourlyRate = s.vehicle_type === '4w' ? s.rate_4w : s.rate_2w;
    const extraFee = Math.round((hourlyRate * additionalMinutes) / 60 * 1.1);
    const newExpiry = new Date(new Date(s.expires_at).getTime() + additionalMinutes * 60 * 1000);
    const newDuration = s.duration_minutes + additionalMinutes;

    await pool.query(
      `UPDATE sessions SET expires_at=$1, duration_minutes=$2, total_paid=total_paid+$3 WHERE id=$4`,
      [newExpiry, newDuration, extraFee, s.id]
    );

    res.json({ message: 'Session extended.', newExpiresAt: newExpiry, extraFee });
  }
);

// POST /sessions/:id/stop
router.post('/:id/stop', auth, async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE sessions SET status='completed', ended_at=NOW()
     WHERE id=$1 AND user_id=$2 AND status='active' RETURNING zone_code`,
    [req.params.id, req.user.userId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Active session not found.' });

  await pool.query(
    `UPDATE zones SET available_spots = available_spots + 1 WHERE code=$1`,
    [rows[0].zone_code]
  );

  res.json({ message: 'Session ended.' });
});

// GET /sessions/history
router.get('/history', auth, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  const { rows } = await pool.query(
    `SELECT s.*, z.name AS zone_name
     FROM sessions s JOIN zones z ON s.zone_code = z.code
     WHERE s.user_id=$1
     ORDER BY s.started_at DESC
     LIMIT $2 OFFSET $3`,
    [req.user.userId, limit, offset]
  );

  res.json({
    sessions: rows.map(s => ({
      sessionId: s.id,
      zoneName: s.zone_name,
      zoneCode: s.zone_code,
      date: new Date(s.started_at).toISOString().replace('T', ' ').slice(0, 16),
      duration: formatDuration(s.duration_minutes),
      totalPaid: s.total_paid,
      status: s.status === 'active' ? 'active' : s.status === 'fine' ? 'fine' : 'completed',
    })),
    page,
    limit,
  });
});

// GET /sessions/:id
router.get('/:id', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.*, z.name AS zone_name, z.city FROM sessions s
     JOIN zones z ON s.zone_code = z.code
     WHERE s.id=$1 AND s.user_id=$2`,
    [req.params.id, req.user.userId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Session not found.' });
  res.json(formatSession(rows[0]));
});

function formatSession(s) {
  return {
    sessionId: s.id,
    zoneCode: s.zone_code,
    zoneName: s.zone_name,
    zoneLocation: `${s.city}, Nepal`,
    startTime: s.started_at,
    expiresAt: s.expires_at,
    durationMinutes: s.duration_minutes,
    fee: s.fee,
    serviceFee: s.service_fee,
    totalPaid: s.total_paid,
    vehicleType: s.vehicle_type,
    paymentMethod: s.payment_method,
    qrToken: s.qr_token,
    status: s.status,
  };
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

module.exports = router;
