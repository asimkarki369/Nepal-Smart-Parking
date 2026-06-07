import { create } from 'zustand';

export type VehicleType = '2w' | '4w' | 'ev' | 'bus';

// ── Driver types ──────────────────────────────────────────────────────────────
export interface User {
  id: string;
  fullName: string;
  phone: string;
  plateNumber: string;
  vehicleType: VehicleType;
  walletBalance: number;
  /**
   * true  — backend confirmed this plate matches the Bluebook / vehicle registration.
   * false — plate is self-declared only (default for new accounts until verified).
   * Officers can see this flag; fines still go to the account holder regardless.
   */
  plateVerified?: boolean;
}

export interface ActiveSession {
  sessionId: string;
  zoneCode: string;
  zoneName: string;
  zoneLocation: string;
  startTime: Date;
  endTimeCap: Date | null;
  vehicleType: VehicleType;
  hourlyRate: number;
  paymentMethod: string;
  qrToken: string;
  // legacy compat
  expiresAt: Date;
  durationMinutes: number;
  fee: number;
  serviceFee: number;
  totalPaid: number;
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

// ── Live session registry (shared between driver & officer) ───────────────────
// Indexed by plate number — officer reads this to verify vehicles
export interface RegistryEntry {
  sessionId:    string;
  plateNumber:  string;
  driverName:   string;
  phone:        string;
  vehicleType:  VehicleType;
  zoneCode:     string;
  zoneName:     string;
  startTime:    Date;
  endTimeCap:   Date | null;
  hourlyRate:   number;
  paymentMethod:string;
  qrToken:      string;
}

// ── Officer types ─────────────────────────────────────────────────────────────
export interface Officer {
  id: string;
  name: string;
  zone: string;
  badgeNumber: string;
}

export interface IssuedFine {
  fineId:       string;
  sessionToken: string;
  plateNumber?: string;
  zoneName:     string;
  overtimeMins: number;
  fineAmount:   number;
  issuedAt:     Date;
  officerId:    string;
  paid:         boolean;
}

// ── Store interface ───────────────────────────────────────────────────────────
interface NSPStore {
  // Driver
  user:           User | null;
  isAuthenticated:boolean;
  activeSession:  ActiveSession | null;
  sessionHistory: SessionHistory[];
  walletBalance:  number;

  setUser:           (user: User) => void;
  logout:            () => void;
  setActiveSession:  (session: ActiveSession | null) => void;
  extendSession:     (additionalMinutes: number) => void;
  setSessionHistory: (history: SessionHistory[]) => void;
  setWalletBalance:  (balance: number) => void;

  // Live session registry — shared with officer
  sessionRegistry: Record<string, RegistryEntry>;  // key = plateNumber.toUpperCase()
  registerSession:   (entry: RegistryEntry) => void;
  unregisterSession: (plateNumber: string) => void;

  // Officer
  officer:       Officer | null;
  isOfficer:     boolean;
  issuedFines:   IssuedFine[];
  setOfficer:    (officer: Officer) => void;
  officerLogout: () => void;
  addFine:       (fine: IssuedFine) => void;
}

export const useStore = create<NSPStore>((set, get) => ({
  // ── Driver state ────────────────────────────────────────────────────────────
  user:            null,
  isAuthenticated: false,
  activeSession:   null,
  sessionHistory:  [],
  walletBalance:   0,

  setUser: (user) => set({ user, isAuthenticated: true, walletBalance: user.walletBalance }),

  logout: () => {
    // Also unregister session from registry
    const s = get().activeSession;
    const u = get().user;
    if (s && u) {
      const reg = { ...get().sessionRegistry };
      delete reg[u.plateNumber.toUpperCase()];
      set({ sessionRegistry: reg });
    }
    set({ user: null, isAuthenticated: false, activeSession: null });
  },

  setActiveSession: (session) => {
    const user = get().user;
    if (session && user) {
      // Register in shared registry so officer can see it
      const entry: RegistryEntry = {
        sessionId:    session.sessionId,
        plateNumber:  user.plateNumber,
        driverName:   user.fullName,
        phone:        user.phone,
        vehicleType:  session.vehicleType,
        zoneCode:     session.zoneCode,
        zoneName:     session.zoneName,
        startTime:    session.startTime,
        endTimeCap:   session.endTimeCap,
        hourlyRate:   session.hourlyRate,
        paymentMethod:session.paymentMethod,
        qrToken:      session.qrToken,
      };
      const reg = { ...get().sessionRegistry };
      reg[user.plateNumber.toUpperCase()] = entry;
      set({ activeSession: session, sessionRegistry: reg });
    } else {
      // Session ended — remove from registry
      if (user) {
        const reg = { ...get().sessionRegistry };
        delete reg[user.plateNumber.toUpperCase()];
        set({ activeSession: null, sessionRegistry: reg });
      } else {
        set({ activeSession: null });
      }
    }
  },

  extendSession: (additionalMinutes) => {
    const sess = get().activeSession;
    const user = get().user;
    if (!sess) return;
    const cap = sess.endTimeCap
      ? new Date(sess.endTimeCap.getTime() + additionalMinutes * 60000)
      : null;
    const updated = { ...sess, endTimeCap: cap, expiresAt: cap ?? sess.expiresAt, durationMinutes: sess.durationMinutes + additionalMinutes };
    // Also update registry
    if (user) {
      const reg = { ...get().sessionRegistry };
      if (reg[user.plateNumber.toUpperCase()]) {
        reg[user.plateNumber.toUpperCase()] = { ...reg[user.plateNumber.toUpperCase()], endTimeCap: cap };
      }
      set({ activeSession: updated, sessionRegistry: reg });
    } else {
      set({ activeSession: updated });
    }
  },

  setSessionHistory: (history) => set({ sessionHistory: history }),
  setWalletBalance:  (balance) => set({ walletBalance: balance }),

  // ── Registry ────────────────────────────────────────────────────────────────
  sessionRegistry: {
    // Pre-seed with demo data so officer can test without a real driver logged in
    'BA 1 KHA 1234': {
      sessionId: 'DEMO-001', plateNumber: 'BA 1 KHA 1234',
      driverName: 'Ram Sharma', phone: '+977 9812345678',
      vehicleType: '4w', zoneCode: 'Z-KMC-01', zoneName: 'New Road',
      startTime: new Date(Date.now() - 95 * 60000),
      endTimeCap: new Date(Date.now() - 35 * 60000),
      hourlyRate: 50, paymentMethod: 'esewa', qrToken: 'QR-DEMO-001',
    },
    'BA 2 CHA 5678': {
      sessionId: 'DEMO-002', plateNumber: 'BA 2 CHA 5678',
      driverName: 'Sita Thapa', phone: '+977 9845678901',
      vehicleType: '2w', zoneCode: 'Z-KMC-01', zoneName: 'New Road',
      startTime: new Date(Date.now() - 30 * 60000),
      endTimeCap: new Date(Date.now() + 30 * 60000),
      hourlyRate: 25, paymentMethod: 'khalti', qrToken: 'QR-DEMO-002',
    },
    'GA 1 JA 9012': {
      sessionId: 'DEMO-003', plateNumber: 'GA 1 JA 9012',
      driverName: 'Hari Karki', phone: '+977 9823456789',
      vehicleType: '4w', zoneCode: 'Z-KMC-01', zoneName: 'New Road',
      startTime: new Date(Date.now() - 150 * 60000),
      endTimeCap: new Date(Date.now() - 90 * 60000),
      hourlyRate: 50, paymentMethod: 'connectips', qrToken: 'QR-DEMO-003',
    },
  },

  registerSession:   (entry) => set(s => ({
    sessionRegistry: { ...s.sessionRegistry, [entry.plateNumber.toUpperCase()]: entry },
  })),
  unregisterSession: (plate) => set(s => {
    const reg = { ...s.sessionRegistry };
    delete reg[plate.toUpperCase()];
    return { sessionRegistry: reg };
  }),

  // ── Officer state ────────────────────────────────────────────────────────────
  officer:       null,
  isOfficer:     false,
  issuedFines:   [],
  setOfficer:    (officer) => set({ officer, isOfficer: true }),
  officerLogout: ()        => set({ officer: null, isOfficer: false, issuedFines: [] }),
  addFine:       (fine)    => set(s => ({ issuedFines: [fine, ...s.issuedFines] })),
}));
