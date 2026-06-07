export interface PlateSession {
  sessionToken: string;
  plate: string;
  driverName: string;
  phone: string;
  vehicleType: '2w' | '4w' | 'ev' | 'bus';
  zoneName: string;
  zoneCode: string;
  startTime: Date;
  endTimeCap: Date | null;
  hourlyRate: number;
}

export const PLATE_SESSION_DB: Record<string, PlateSession> = {
  'BA 1 KHA 1234': {
    sessionToken: 'QR-Z-KMC-01-DEMO1',
    plate: 'BA 1 KHA 1234',
    driverName: 'Ram Sharma',
    phone: '+977 9812345678',
    vehicleType: '4w',
    zoneName: 'New Road', zoneCode: 'Z-KMC-01',
    startTime:   new Date(Date.now() - 95 * 60000),
    endTimeCap:  new Date(Date.now() - 35 * 60000),
    hourlyRate: 50,
  },
  'BA 2 CHA 5678': {
    sessionToken: 'QR-Z-KMC-01-DEMO2',
    plate: 'BA 2 CHA 5678',
    driverName: 'Sita Thapa',
    phone: '+977 9845678901',
    vehicleType: '2w',
    zoneName: 'New Road', zoneCode: 'Z-KMC-01',
    startTime:   new Date(Date.now() - 30 * 60000),
    endTimeCap:  new Date(Date.now() + 30 * 60000),
    hourlyRate: 25,
  },
  'GA 1 JA 9012': {
    sessionToken: 'QR-Z-KMC-01-DEMO3',
    plate: 'GA 1 JA 9012',
    driverName: 'Hari Karki',
    phone: '+977 9823456789',
    vehicleType: '4w',
    zoneName: 'New Road', zoneCode: 'Z-KMC-01',
    startTime:   new Date(Date.now() - 150 * 60000),
    endTimeCap:  new Date(Date.now() - 90 * 60000),
    hourlyRate: 50,
  },
  // Fallback for no-session lookup
  'UNKNOWN': {
    sessionToken: '',
    plate: '', driverName: '', phone: '',
    vehicleType: '4w',
    zoneName: '', zoneCode: '',
    startTime: new Date(), endTimeCap: null, hourlyRate: 0,
  },
};
