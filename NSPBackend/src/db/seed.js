require('dotenv').config();
const pool = require('./pool');

const zones = [
  { code: 'Z-KMC-01', name: 'New Road',      city: 'Kathmandu', lat: 27.7048, lng: 85.3132, rate4w: 80, rate2w: 25, total: 50, available: 8  },
  { code: 'Z-KMC-02', name: 'Putalisadak',   city: 'Kathmandu', lat: 27.7014, lng: 85.3199, rate4w: 80, rate2w: 25, total: 40, available: 0  },
  { code: 'Z-KMC-03', name: 'Thamel',        city: 'Kathmandu', lat: 27.7155, lng: 85.3123, rate4w: 80, rate2w: 25, total: 60, available: 22 },
  { code: 'Z-KMC-04', name: 'Durbar Marg',   city: 'Kathmandu', lat: 27.7120, lng: 85.3145, rate4w: 80, rate2w: 25, total: 60, available: 3  },
  { code: 'Z-KMC-05', name: 'Baneshwor',     city: 'Kathmandu', lat: 27.6939, lng: 85.3392, rate4w: 60, rate2w: 20, total: 45, available: 15 },
  { code: 'Z-PMC-01', name: 'New Road',      city: 'Pokhara',   lat: 28.2096, lng: 83.9856, rate4w: 60, rate2w: 20, total: 35, available: 12 },
  { code: 'Z-PMC-02', name: 'Lakeside',      city: 'Pokhara',   lat: 28.2132, lng: 83.9558, rate4w: 60, rate2w: 20, total: 40, available: 18 },
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding zones...');
    for (const z of zones) {
      await client.query(
        `INSERT INTO zones (code, name, city, latitude, longitude, rate_4w, rate_2w, total_spots, available_spots)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (code) DO UPDATE SET
           name=EXCLUDED.name, available_spots=EXCLUDED.available_spots`,
        [z.code, z.name, z.city, z.lat, z.lng, z.rate4w, z.rate2w, z.total, z.available]
      );
    }
    console.log(`✓ Seeded ${zones.length} zones.`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => { console.error('Seed failed:', err); process.exit(1); });
