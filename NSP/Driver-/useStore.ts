// src/store/useStore.ts
import { create } from 'zustand';

export interface User {
  id: string;
  fullName: string;
  phone: string;
  plateNumber: string;
  vehicleType: '2w' | '4w';
  walletBalance: number;
}

export interface ActiveSession {
  sessionId: string;
  zoneCode: string;
  zoneName: string;
  zoneLocation: string;
  startTime: Date;
  expiresAt: Date;
  durationMinutes: number;
  fee: number;
  serviceFee: number;
  totalPaid: number;
  vehicleType: '2w' | '4w';
  paymentMethod: string;
  qrToken: string;
}

export interface SessionHistory {
  sessionId: string;
  zoneName: string;
  zoneCode: string;
  date: string;
  duration: string;
  totalPaid: number;
  status: 'completed' | 'fine' | 'active';
}

interface NSPStore {
  user: User | null;
  isAuthenticated: boolean;
  activeSession: ActiveSession | null;
  sessionHistory: SessionHistory[];
  walletBalance: number;

  setUser: (user: User) => void;
  logout: () => void;
  setActiveSession: (session: ActiveSession | null) => void;
  extendSession: (additionalMinutes: number) => void;
  setSessionHistory: (history: SessionHistory[]) => void;
  setWalletBalance: (balance: number) => void;
}

export const useStore = create<NSPStore>((set: any, get: any) => ({
  user: null,
  isAuthenticated: false,
  activeSession: null,
  sessionHistory: [],
  walletBalance: 0,

  setUser: (user: User) => set({ user, isAuthenticated: true, walletBalance: user.walletBalance }),

  logout: () => set({ user: null, isAuthenticated: false, activeSession: null }),

  setActiveSession: (session: ActiveSession | null) => set({ activeSession: session }),

  extendSession: (additionalMinutes: number) => {
    const sess = get().activeSession;
    if (!sess) return;
    const newExpiry = new Date(sess.expiresAt.getTime() + additionalMinutes * 60 * 1000);
    set({
      activeSession: {
        ...sess,
        expiresAt: newExpiry,
        durationMinutes: sess.durationMinutes + additionalMinutes,
        totalPaid: sess.totalPaid + (sess.vehicleType === '4w' ? 80 : 25),
      },
    });
  },

  setSessionHistory: (history: SessionHistory[]) => set({ sessionHistory: history }),

  setWalletBalance: (balance: number) => set({ walletBalance: balance }),
}));