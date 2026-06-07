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
  sendOTP: (phone: string) =>
    api.post('/auth/send-otp', { phone }),

  verifyOTP: (phone: string, otp: string) =>
    api.post('/auth/verify-otp', { phone, otp }),

  register: (data: {
    fullName: string; phone: string; plateNumber: string; vehicleType: '2w' | '4w';
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
  rateEv: number;    // Electric vehicle          — Rs 35/hr
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
    rate2w: 25, rate4w: 50, rateEv: 35, rateBus: 75,
    totalSpots: 50, availableSpots: 8,
    occupancyPercent: 84,
  },
  {
    code: 'Z-KMC-02', name: 'Putalisadak', city: 'Kathmandu',
    type: 'standard',
    latitude: 27.7014, longitude: 85.3199,
    rate2w: 25, rate4w: 50, rateEv: 35, rateBus: 75,
    totalSpots: 40, availableSpots: 0,
    occupancyPercent: 100,
  },
  {
    code: 'Z-KMC-04', name: 'Durbar Marg', city: 'Kathmandu',
    type: 'standard',
    latitude: 27.7120, longitude: 85.3145,
    rate2w: 25, rate4w: 50, rateEv: 35, rateBus: 75,
    totalSpots: 60, availableSpots: 3,
    occupancyPercent: 95,
  },
  {
    code: 'Z-PMC-01', name: 'New Road', city: 'Pokhara',
    type: 'standard',
    latitude: 28.2096, longitude: 83.9856,
    rate2w: 25, rate4w: 50, rateEv: 35, rateBus: 75,
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
    rate2w: 25, rate4w: 50, rateEv: 35, rateBus: 75,
    totalSpots: 120, availableSpots: 45,
    occupancyPercent: 63,
    privateOperator: 'Civil Mall Pvt. Ltd.',
  },
  {
    code: 'Z-PRV-02', name: 'Labim Mall Parking', city: 'Kathmandu',
    type: 'private',
    latitude: 27.6878, longitude: 85.3176,
    rate2w: 25, rate4w: 50, rateEv: 35, rateBus: 75,
    totalSpots: 80, availableSpots: 22,
    occupancyPercent: 73,
    privateOperator: 'Labim Mall Pvt. Ltd.',
  },
  // Electric / EV charging zones
  {
    code: 'Z-EV-01', name: 'Bagmati EV Hub', city: 'Kathmandu',
    type: 'electric',
    latitude: 27.6974, longitude: 85.3240,
    rate2w: 25, rate4w: 50, rateEv: 35, rateBus: 75,
    totalSpots: 12, availableSpots: 5,
    occupancyPercent: 58,
    evChargerCount: 12,
  },
  {
    code: 'Z-EV-02', name: 'Patan EV Station', city: 'Lalitpur',
    type: 'electric',
    latitude: 27.6693, longitude: 85.3240,
    rate2w: 25, rate4w: 50, rateEv: 35, rateBus: 75,
    totalSpots: 8, availableSpots: 3,
    occupancyPercent: 63,
    evChargerCount: 8,
  },
];
