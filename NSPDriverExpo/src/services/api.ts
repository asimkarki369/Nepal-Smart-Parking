import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://api.nepalsmsartparking.com/v1';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── AUTH ────────────────────────────────────────────────────────────────────
export const authAPI = {
  /**
   * Sign in with National ID + password.
   * Returns { token: string, user: User }
   */
  login: (data: { nationalId: string; password: string }) =>
    api.post('/auth/login', data),

  /**
   * Register new account — National ID based, multi-vehicle.
   * Returns { token: string, user: User }
   */
  register: (data: {
    fullName:   string;
    nationalId: string;
    phone?:     string;
    password:   string;
    vehicles:   Array<{
      plateNumber:  string;
      vehicleType:  '2w' | '4w' | 'ev' | 'bus';
      isPrimary:    boolean;
      plateVerified:boolean;
    }>;
  }) => api.post('/auth/register', data),

  logout: () => api.post('/auth/logout'),
};

// ─── ZONES ───────────────────────────────────────────────────────────────────
export const zonesAPI = {
  getNearby: (lat: number, lng: number, radius = 2000) =>
    api.get('/zones/nearby', { params: { lat, lng, radius } }),

  getZone: (zoneCode: string) =>
    api.get(`/zones/${zoneCode}`),

  getOccupancy: (zoneCode: string) =>
    api.get(`/zones/${zoneCode}/occupancy`),
};

// ─── SESSIONS ────────────────────────────────────────────────────────────────
export const sessionsAPI = {
  start: (data: {
    zoneCode: string;
    vehicleType: '2w' | '4w';
    durationMinutes: number;
    paymentMethod: string;
  }) => api.post('/sessions/start', data),

  extend: (sessionId: string, additionalMinutes: number) =>
    api.post(`/sessions/${sessionId}/extend`, { additionalMinutes }),

  stop: (sessionId: string) =>
    api.post(`/sessions/${sessionId}/stop`),

  getActive: () => api.get('/sessions/active'),

  getHistory: (page = 1, limit = 20) =>
    api.get('/sessions/history', { params: { page, limit } }),

  getById: (sessionId: string) =>
    api.get(`/sessions/${sessionId}`),
};

// ─── PAYMENTS ────────────────────────────────────────────────────────────────
export const paymentsAPI = {
  initiate: (data: {
    amount: number;
    method: 'esewa' | 'khalti' | 'connectips';
    sessionId?: string;
  }) => api.post('/payments/initiate', data),

  verify: (transactionId: string) =>
    api.get(`/payments/verify/${transactionId}`),

  getBalance: () => api.get('/payments/wallet/balance'),

  topUp: (amount: number, method: string) =>
    api.post('/payments/wallet/topup', { amount, method }),
};

// ─── CHALLANS ────────────────────────────────────────────────────────────────
export const challansAPI = {
  getMyChallans: () => api.get('/challans/my'),

  payFine: (challanId: string, method: string) =>
    api.post(`/challans/${challanId}/pay`, { method }),
};

// ─── ZONE TYPES ──────────────────────────────────────────────────────────────
export type ZoneType = 'standard' | 'free' | 'private' | 'electric';

export interface Zone {
  code: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  type: ZoneType;
  rate2w: number;    // Bike / Scooter            — Rs 25/hr
  rate4w: number;    // Car / Jeep petrol/diesel  — Rs 50/hr
  rateEv: number;    // Electric vehicle          — Rs 15/hr
  rateBus: number;   // Bus / Minivan / Minibus   — Rs 75/hr
  totalSpots: number;
  availableSpots: number;
  occupancyPercent: number;
  freeTimeLimitMins?: number;
  privateOperator?: string;
  evChargerCount?: number;
}

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
export const mockZones: Zone[] = [
  // Standard paid zones
  {
    code: 'Z-KMC-01', name: 'New Road', city: 'Kathmandu',
    type: 'standard',
    latitude: 27.7048, longitude: 85.3132,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 50, availableSpots: 8,
    occupancyPercent: 84,
  },
  {
    code: 'Z-KMC-02', name: 'Putalisadak', city: 'Kathmandu',
    type: 'standard',
    latitude: 27.7014, longitude: 85.3199,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 40, availableSpots: 0,
    occupancyPercent: 100,
  },
  {
    code: 'Z-KMC-04', name: 'Durbar Marg', city: 'Kathmandu',
    type: 'standard',
    latitude: 27.7120, longitude: 85.3145,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 60, availableSpots: 3,
    occupancyPercent: 95,
  },
  {
    code: 'Z-PMC-01', name: 'New Road', city: 'Pokhara',
    type: 'standard',
    latitude: 28.2096, longitude: 83.9856,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 35, availableSpots: 12,
    occupancyPercent: 66,
  },
  // BLA (Free) zones — free parking with time limit
  {
    code: 'Z-BLA-01', name: 'Thamel North', city: 'Kathmandu',
    type: 'free',
    latitude: 27.7155, longitude: 85.3123,
    rate4w: 0, rate2w: 0,
    totalSpots: 30, availableSpots: 14,
    occupancyPercent: 53,
    freeTimeLimitMins: 120,
  },
  {
    code: 'Z-BLA-02', name: 'Baluwatar', city: 'Kathmandu',
    type: 'free',
    latitude: 27.7190, longitude: 85.3280,
    rate4w: 0, rate2w: 0,
    totalSpots: 20, availableSpots: 9,
    occupancyPercent: 55,
    freeTimeLimitMins: 60,
  },
  // Private zones
  {
    code: 'Z-PRV-01', name: 'Civil Mall Parking', city: 'Kathmandu',
    type: 'private',
    latitude: 27.7034, longitude: 85.3164,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 120, availableSpots: 45,
    occupancyPercent: 63,
    privateOperator: 'Civil Mall Pvt. Ltd.',
  },
  {
    code: 'Z-PRV-02', name: 'Labim Mall Parking', city: 'Kathmandu',
    type: 'private',
    latitude: 27.6878, longitude: 85.3176,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 80, availableSpots: 22,
    occupancyPercent: 73,
    privateOperator: 'Labim Mall Pvt. Ltd.',
  },
  // Electric / EV charging zones
  {
    code: 'Z-EV-01', name: 'Bagmati EV Hub', city: 'Kathmandu',
    type: 'electric',
    latitude: 27.6974, longitude: 85.3240,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 12, availableSpots: 5,
    occupancyPercent: 58,
    evChargerCount: 12,
  },
  {
    code: 'Z-EV-02', name: 'Patan EV Station', city: 'Lalitpur',
    type: 'electric',
    latitude: 27.6693, longitude: 85.3240,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 8, availableSpots: 3,
    occupancyPercent: 63,
    evChargerCount: 8,
  },

  // ── BIRATNAGAR ───────────────────────────────────────────────────────────────
  {
    code: 'Z-BRT-01', name: 'Traffic Chowk', city: 'Biratnagar',
    type: 'standard',
    latitude: 26.4534, longitude: 87.2726,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 55, availableSpots: 18,
    occupancyPercent: 67,
  },
  {
    code: 'Z-BRT-02', name: 'Ghantaghar Chowk', city: 'Biratnagar',
    type: 'standard',
    latitude: 26.4669, longitude: 87.2827,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 40, availableSpots: 0,
    occupancyPercent: 100,
  },
  {
    code: 'Z-BRT-03', name: 'Biratnagar Bus Park', city: 'Biratnagar',
    type: 'standard',
    latitude: 26.4698, longitude: 87.2807,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 80, availableSpots: 24,
    occupancyPercent: 70,
  },
  {
    code: 'Z-BLA-03', name: 'Rani Free Parking', city: 'Biratnagar',
    type: 'free',
    latitude: 26.4521, longitude: 87.2695,
    rate2w: 0, rate4w: 0, rateEv: 0, rateBus: 0,
    totalSpots: 25, availableSpots: 11,
    occupancyPercent: 56,
    freeTimeLimitMins: 90,
  },
  {
    code: 'Z-PRV-03', name: 'Mero Mall Parking', city: 'Biratnagar',
    type: 'private',
    latitude: 26.4580, longitude: 87.2770,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 100, availableSpots: 37,
    occupancyPercent: 63,
    privateOperator: 'Mero Mall Pvt. Ltd.',
  },
  {
    code: 'Z-EV-03', name: 'Biratnagar EV Station', city: 'Biratnagar',
    type: 'electric',
    latitude: 26.4600, longitude: 87.2750,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 10, availableSpots: 4,
    occupancyPercent: 60,
    evChargerCount: 10,
  },

  // ── DAMAK ────────────────────────────────────────────────────────────────────
  {
    code: 'Z-DMK-01', name: 'Damak Bazaar', city: 'Damak',
    type: 'standard',
    latitude: 26.6559, longitude: 87.6993,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 35, availableSpots: 14,
    occupancyPercent: 60,
  },
  {
    code: 'Z-DMK-02', name: 'Damak Chowk', city: 'Damak',
    type: 'standard',
    latitude: 26.6570, longitude: 87.6960,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 30, availableSpots: 7,
    occupancyPercent: 77,
  },
  {
    code: 'Z-DMK-03', name: 'Damak Bus Park', city: 'Damak',
    type: 'standard',
    latitude: 26.6540, longitude: 87.6975,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 50, availableSpots: 19,
    occupancyPercent: 62,
  },
  {
    code: 'Z-BLA-04', name: 'Buddha Park Free Zone', city: 'Damak',
    type: 'free',
    latitude: 26.6540, longitude: 87.7020,
    rate2w: 0, rate4w: 0, rateEv: 0, rateBus: 0,
    totalSpots: 20, availableSpots: 8,
    occupancyPercent: 60,
    freeTimeLimitMins: 60,
  },

  // ── BIRGUNJ ──────────────────────────────────────────────────────────────────
  {
    code: 'Z-BGJ-01', name: 'Maisthan Chowk', city: 'Birgunj',
    type: 'standard',
    latitude: 27.0104, longitude: 84.8777,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 60, availableSpots: 5,
    occupancyPercent: 92,
  },
  {
    code: 'Z-BGJ-02', name: 'Ghantaghar', city: 'Birgunj',
    type: 'standard',
    latitude: 27.0148, longitude: 84.8742,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 45, availableSpots: 13,
    occupancyPercent: 71,
  },
  {
    code: 'Z-BGJ-03', name: 'Birgunj Bus Park', city: 'Birgunj',
    type: 'standard',
    latitude: 27.0080, longitude: 84.8700,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 90, availableSpots: 31,
    occupancyPercent: 66,
  },
  {
    code: 'Z-BLA-05', name: 'Birgunj Gate Free Zone', city: 'Birgunj',
    type: 'free',
    latitude: 27.0019, longitude: 84.8736,
    rate2w: 0, rate4w: 0, rateEv: 0, rateBus: 0,
    totalSpots: 30, availableSpots: 12,
    occupancyPercent: 60,
    freeTimeLimitMins: 30,
  },
  {
    code: 'Z-PRV-04', name: 'Birgunj Plaza Parking', city: 'Birgunj',
    type: 'private',
    latitude: 27.0110, longitude: 84.8760,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 75, availableSpots: 28,
    occupancyPercent: 63,
    privateOperator: 'Birgunj Plaza Pvt. Ltd.',
  },
  {
    code: 'Z-EV-04', name: 'Birgunj EV Hub', city: 'Birgunj',
    type: 'electric',
    latitude: 27.0090, longitude: 84.8720,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 8, availableSpots: 3,
    occupancyPercent: 63,
    evChargerCount: 8,
  },

  // ── BHARATPUR ────────────────────────────────────────────────────────────────
  {
    code: 'Z-BHP-01', name: 'Narayangadh Chowk', city: 'Bharatpur',
    type: 'standard',
    latitude: 27.7043, longitude: 84.4290,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 50, availableSpots: 9,
    occupancyPercent: 82,
  },
  {
    code: 'Z-BHP-02', name: 'Bharatpur Main Road', city: 'Bharatpur',
    type: 'standard',
    latitude: 27.6945, longitude: 84.4317,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 40, availableSpots: 16,
    occupancyPercent: 60,
  },
  {
    code: 'Z-BHP-03', name: 'Bharatpur Hospital Area', city: 'Bharatpur',
    type: 'standard',
    latitude: 27.6855, longitude: 84.4278,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 35, availableSpots: 0,
    occupancyPercent: 100,
  },
  {
    code: 'Z-BLA-06', name: 'Sauraha Free Parking', city: 'Bharatpur',
    type: 'free',
    latitude: 27.5765, longitude: 84.5032,
    rate2w: 0, rate4w: 0, rateEv: 0, rateBus: 0,
    totalSpots: 40, availableSpots: 22,
    occupancyPercent: 45,
    freeTimeLimitMins: 120,
  },
  {
    code: 'Z-PRV-05', name: 'Chitwan Mall Parking', city: 'Bharatpur',
    type: 'private',
    latitude: 27.6995, longitude: 84.4300,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 90, availableSpots: 34,
    occupancyPercent: 62,
    privateOperator: 'Chitwan Mall Pvt. Ltd.',
  },
  {
    code: 'Z-EV-05', name: 'Bharatpur EV Station', city: 'Bharatpur',
    type: 'electric',
    latitude: 27.6850, longitude: 84.4340,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 10, availableSpots: 6,
    occupancyPercent: 40,
    evChargerCount: 10,
  },

  // ── BUTWAL ───────────────────────────────────────────────────────────────────
  {
    code: 'Z-BTW-01', name: 'Traffic Chowk', city: 'Butwal',
    type: 'standard',
    latitude: 27.7006, longitude: 83.4532,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 45, availableSpots: 11,
    occupancyPercent: 76,
  },
  {
    code: 'Z-BTW-02', name: 'Kalikanagar', city: 'Butwal',
    type: 'standard',
    latitude: 27.7101, longitude: 83.4612,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 35, availableSpots: 8,
    occupancyPercent: 77,
  },
  {
    code: 'Z-BTW-03', name: 'Butwal Bus Park', city: 'Butwal',
    type: 'standard',
    latitude: 27.6953, longitude: 83.4548,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 70, availableSpots: 26,
    occupancyPercent: 63,
  },
  {
    code: 'Z-BLA-07', name: 'Devdaha Free Zone', city: 'Butwal',
    type: 'free',
    latitude: 27.6850, longitude: 83.4400,
    rate2w: 0, rate4w: 0, rateEv: 0, rateBus: 0,
    totalSpots: 25, availableSpots: 10,
    occupancyPercent: 60,
    freeTimeLimitMins: 90,
  },
  {
    code: 'Z-PRV-06', name: 'Butwal Plaza Parking', city: 'Butwal',
    type: 'private',
    latitude: 27.7030, longitude: 83.4510,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 60, availableSpots: 21,
    occupancyPercent: 65,
    privateOperator: 'Butwal Plaza Pvt. Ltd.',
  },
  {
    code: 'Z-EV-06', name: 'Butwal EV Charging Hub', city: 'Butwal',
    type: 'electric',
    latitude: 27.7050, longitude: 83.4560,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 8, availableSpots: 2,
    occupancyPercent: 75,
    evChargerCount: 8,
  },

  // ── DHANGADHI ────────────────────────────────────────────────────────────────
  {
    code: 'Z-DGD-01', name: 'Dhangadhi Main Bazaar', city: 'Dhangadhi',
    type: 'standard',
    latitude: 28.6941, longitude: 80.5992,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 40, availableSpots: 17,
    occupancyPercent: 58,
  },
  {
    code: 'Z-DGD-02', name: 'Airport Road', city: 'Dhangadhi',
    type: 'standard',
    latitude: 28.7014, longitude: 80.5854,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 30, availableSpots: 9,
    occupancyPercent: 70,
  },
  {
    code: 'Z-DGD-03', name: 'Dhangadhi Bus Park', city: 'Dhangadhi',
    type: 'standard',
    latitude: 28.6960, longitude: 80.6010,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 55, availableSpots: 20,
    occupancyPercent: 64,
  },
  {
    code: 'Z-BLA-08', name: 'Seti River Free Zone', city: 'Dhangadhi',
    type: 'free',
    latitude: 28.7100, longitude: 80.5900,
    rate2w: 0, rate4w: 0, rateEv: 0, rateBus: 0,
    totalSpots: 30, availableSpots: 15,
    occupancyPercent: 50,
    freeTimeLimitMins: 120,
  },
  {
    code: 'Z-PRV-07', name: 'Far West Mall Parking', city: 'Dhangadhi',
    type: 'private',
    latitude: 28.6960, longitude: 80.5970,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 50, availableSpots: 18,
    occupancyPercent: 64,
    privateOperator: 'Far West Mall Pvt. Ltd.',
  },
  {
    code: 'Z-EV-07', name: 'Dhangadhi Green Hub', city: 'Dhangadhi',
    type: 'electric',
    latitude: 28.6930, longitude: 80.5950,
    rate2w: 25, rate4w: 50, rateEv: 15, rateBus: 75,
    totalSpots: 6, availableSpots: 4,
    occupancyPercent: 33,
    evChargerCount: 6,
  },
];
