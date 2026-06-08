import { create } from 'zustand';

// ── Officer ───────────────────────────────────────────────────────────────────
export interface Officer {
  id:          string;
  name:        string;
  zone:        string;
  badgeNumber: string;
}

// ── Live session registry entry (populated by driver app in production) ───────
export interface RegistryEntry {
  sessionId:    string;
  plateNumber:  string;
  driverName:   string;
  phone:        string;
  vehicleType:  '2w' | '4w' | 'ev' | 'bus';
  zoneCode:     string;
  zoneName:     string;
  startTime:    Date;
  endTimeCap:   Date | null;
  hourlyRate:   number;
  paymentMethod:string;
  qrToken:      string;
}

// ── Issued fine ───────────────────────────────────────────────────────────────
export interface IssuedFine {
  fineId:       string;
  sessionToken: string;
  plateNumber:  string;
  zoneName:     string;
  overtimeMins: number;
  fineAmount:   number;
  issuedAt:     Date;
  officerId:    string;
  paid:         boolean;
}

// ── Demo session registry — replace with real API in production ───────────────
const DEMO_REGISTRY: Record<string, RegistryEntry> = {
  'BA 1 KHA 1234': {
    sessionId: 'SES_001', plateNumber: 'BA 1 KHA 1234',
    driverName: 'Asim Karki', phone: '9841000001',
    vehicleType: '4w', zoneCode: 'Z-KMC-01', zoneName: 'New Road',
    startTime: new Date(Date.now() - 45 * 60000),
    endTimeCap: new Date(Date.now() + 15 * 60000),
    hourlyRate: 50, paymentMethod: 'eSewa', qrToken: 'QR_001',
  },
  'GA 1 JA 9012': {
    sessionId: 'SES_002', plateNumber: 'GA 1 JA 9012',
    driverName: 'Priya Sharma', phone: '9841000002',
    vehicleType: '2w', zoneCode: 'Z-KMC-02', zoneName: 'Putalisadak',
    startTime: new Date(Date.now() - 3 * 3600000),
    endTimeCap: new Date(Date.now() - 45 * 60000),
    hourlyRate: 25, paymentMethod: 'Khalti', qrToken: 'QR_002',
  },
};

// ── Store ─────────────────────────────────────────────────────────────────────
interface OfficerStore {
  officer:         Officer | null;
  isOfficer:       boolean;
  issuedFines:     IssuedFine[];
  sessionRegistry: Record<string, RegistryEntry>;

  setOfficer:    (officer: Officer) => void;
  officerLogout: () => void;
  addFine:       (fine: IssuedFine) => void;
  lookupSession: (plate: string) => RegistryEntry | undefined;
}

export const useStore = create<OfficerStore>((set, get) => ({
  officer:         null,
  isOfficer:       false,
  issuedFines:     [],
  sessionRegistry: DEMO_REGISTRY,

  setOfficer: (officer) => set({ officer, isOfficer: true }),

  officerLogout: () => set({ officer: null, isOfficer: false, issuedFines: [] }),

  addFine: (fine) => set((s) => ({ issuedFines: [...s.issuedFines, fine] })),

  lookupSession: (plate) => {
    const reg = get().sessionRegistry;
    const key = plate.trim().toUpperCase();
    return reg[key] ?? Object.values(reg).find(
      s => s.plateNumber.replace(/\s/g, '').toUpperCase() === key.replace(/\s/g, ''),
    );
  },
}));
