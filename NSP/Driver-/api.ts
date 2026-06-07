// src/services/api.ts
import axios from 'axios';

const BASE_URL = 'https://api.nepalsmsartparking.com/v1'; // Replace with actual API

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token to every request
api.interceptors.request.use((config: any) => {
  const token = ''; // Pull from AsyncStorage / Zustand store in production
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── AUTH ───────────────────────────────────────────────────────────────
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

// ─── ZONES ──────────────────────────────────────────────────────────────
export const zonesAPI = {
  getNearby: (lat: number, lng: number, radius = 2000) =>
    api.get('/zones/nearby', { params: { lat, lng, radius } }),

  getZone: (zoneCode: string) =>
    api.get(`/zones/${zoneCode}`),

  getOccupancy: (zoneCode: string) =>
    api.get(`/zones/${zoneCode}/occupancy`),
};

// ─── SESSIONS ───────────────────────────────────────────────────────────
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

  getActive: () =>
    api.get('/sessions/active'),

  getHistory: (page = 1, limit = 20) =>
    api.get('/sessions/history', { params: { page, limit } }),

  getById: (sessionId: string) =>
    api.get(`/sessions/${sessionId}`),
};

// ─── PAYMENTS ───────────────────────────────────────────────────────────
export const paymentsAPI = {
  initiate: (data: {
    amount: number;
    method: 'esewa' | 'khalti' | 'connectips';
    sessionId?: string;
  }) => api.post('/payments/initiate', data),

  verify: (transactionId: string) =>
    api.get(`/payments/verify/${transactionId}`),

  getBalance: () =>
    api.get('/payments/wallet/balance'),

  topUp: (amount: number, method: string) =>
    api.post('/payments/wallet/topup', { amount, method }),
};

// ─── CHALLANS / FINES ───────────────────────────────────────────────────
export const challansAPI = {
  getMyChallans: () =>
    api.get('/challans/my'),

  payFine: (challanId: string, method: string) =>
    api.post(`/challans/${challanId}/pay`, { method }),
};

// ─── MOCK DATA (for development / offline use) ──────────────────────────
export const mockZones = [
  {
    code: 'Z-KMC-01', name: 'New Road', city: 'Kathmandu',
    latitude: 27.7048, longitude: 85.3132,
    rate4w: 80, rate2w: 25,
    totalSpots: 50, availableSpots: 8,
    occupancyPercent: 84,
  },
  {
    code: 'Z-KMC-02', name: 'Putalisadak', city: 'Kathmandu',
    latitude: 27.7014, longitude: 85.3199,
    rate4w: 80, rate2w: 25,
    totalSpots: 40, availableSpots: 0,
    occupancyPercent: 100,
  },
  {
    code: 'Z-KMC-04', name: 'Durbar Marg', city: 'Kathmandu',
    latitude: 27.7120, longitude: 85.3145,
    rate4w: 80, rate2w: 25,
    totalSpots: 60, availableSpots: 3,
    occupancyPercent: 95,
  },
  {
    code: 'Z-PMC-01', name: 'New Road', city: 'Pokhara',
    latitude: 28.2096, longitude: 83.9856,
    rate4w: 60, rate2w: 20,
    totalSpots: 35, availableSpots: 12,
    occupancyPercent: 66,
  },
];