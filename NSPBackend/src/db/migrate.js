require('dotenv').config();
const pool = require('./pool');

const schema = `
-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(15) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  plate_number VARCHAR(20) NOT NULL,
  vehicle_type VARCHAR(3) NOT NULL CHECK (vehicle_type IN ('2w', '4w')),
  wallet_balance INTEGER NOT NULL DEFAULT 0,
  refresh_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OTP store
CREATE TABLE IF NOT EXISTS otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(15) NOT NULL,
  code VARCHAR(10) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otps_phone ON otps(phone);

-- Zones
CREATE TABLE IF NOT EXISTS zones (
  code VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  city VARCHAR(50) NOT NULL,
  latitude NUMERIC(10,6) NOT NULL,
  longitude NUMERIC(10,6) NOT NULL,
  rate_4w INTEGER NOT NULL DEFAULT 80,
  rate_2w INTEGER NOT NULL DEFAULT 25,
  total_spots INTEGER NOT NULL DEFAULT 50,
  available_spots INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Parking sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  zone_code VARCHAR(20) NOT NULL REFERENCES zones(code),
  vehicle_type VARCHAR(3) NOT NULL CHECK (vehicle_type IN ('2w', '4w')),
  duration_minutes INTEGER NOT NULL,
  fee INTEGER NOT NULL,
  service_fee INTEGER NOT NULL,
  total_paid INTEGER NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  qr_token VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'fine')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_zone_code ON sessions(zone_code);
CREATE INDEX IF NOT EXISTS idx_sessions_qr_token ON sessions(qr_token);

-- Challans (fines)
CREATE TABLE IF NOT EXISTS challans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id),
  user_id UUID NOT NULL REFERENCES users(id),
  zone_code VARCHAR(20) NOT NULL REFERENCES zones(code),
  plate_number VARCHAR(20) NOT NULL,
  fine_amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  issued_by VARCHAR(100),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_challans_user_id ON challans(user_id);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  session_id UUID REFERENCES sessions(id),
  amount INTEGER NOT NULL,
  method VARCHAR(20) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('parking', 'topup', 'fine')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  transaction_ref VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    await client.query(schema);
    console.log('✓ Migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => { console.error('Migration failed:', err); process.exit(1); });
