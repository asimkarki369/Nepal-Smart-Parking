const router = require('express').Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');

// GET /zones/nearby?lat=&lng=&radius=
router.get('/nearby', auth, async (req, res) => {
  const { lat, lng, radius = 2000 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required.' });

  // Haversine approximation in SQL using bounding box, then distance calc
  const { rows } = await pool.query(
    `SELECT *,
      (6371000 * acos(
        cos(radians($1)) * cos(radians(latitude)) *
        cos(radians(longitude) - radians($2)) +
        sin(radians($1)) * sin(radians(latitude))
      )) AS distance_m
     FROM zones
     WHERE is_active = TRUE
     HAVING (6371000 * acos(
        cos(radians($1)) * cos(radians(latitude)) *
        cos(radians(longitude) - radians($2)) +
        sin(radians($1)) * sin(radians(latitude))
      )) <= $3
     ORDER BY distance_m
     LIMIT 20`,
    [parseFloat(lat), parseFloat(lng), parseFloat(radius)]
  );

  res.json({ zones: rows.map(formatZone) });
});

// GET /zones/:code
router.get('/:code', auth, async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM zones WHERE code=$1`, [req.params.code]);
  if (!rows.length) return res.status(404).json({ error: 'Zone not found.' });
  res.json(formatZone(rows[0]));
});

// GET /zones/:code/occupancy
router.get('/:code/occupancy', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT total_spots, available_spots FROM zones WHERE code=$1`,
    [req.params.code]
  );
  if (!rows.length) return res.status(404).json({ error: 'Zone not found.' });
  const z = rows[0];
  res.json({
    totalSpots: z.total_spots,
    availableSpots: z.available_spots,
    occupancyPercent: Math.round(((z.total_spots - z.available_spots) / z.total_spots) * 100),
  });
});

function formatZone(z) {
  return {
    code: z.code,
    name: z.name,
    city: z.city,
    latitude: parseFloat(z.latitude),
    longitude: parseFloat(z.longitude),
    rate4w: z.rate_4w,
    rate2w: z.rate_2w,
    totalSpots: z.total_spots,
    availableSpots: z.available_spots,
    occupancyPercent: Math.round(((z.total_spots - z.available_spots) / z.total_spots) * 100),
  };
}

module.exports = router;
