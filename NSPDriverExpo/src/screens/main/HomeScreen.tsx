import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  StatusBar, ActivityIndicator, Alert, Modal, FlatList,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import * as Notifications from 'expo-notifications';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Colors, Spacing, BorderRadius } from '@/utils/theme';
import { mockZones, sessionsAPI, Zone, ZoneType } from '@/services/api';
import { useStore, primaryVehicle } from '@/store/useStore';
import { RootStackParamList } from '@/navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Main'>;

const PAYMENT_METHODS = [
  { id: 'esewa',      label: 'eSewa',       color: '#60BB46' },
  { id: 'khalti',     label: 'Khalti',      color: '#5C2D91' },
  { id: 'connectips', label: 'ConnectIPS',  color: '#E84142' },
] as const;
type PMId = typeof PAYMENT_METHODS[number]['id'];

const HISTORY_KEY = 'nsp_search_history';
const MAX_HISTORY = 5;

// ── helpers ──────────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, '0'); }

function fmtElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function calcCost(startTime: Date, endTime: Date, hourlyRate: number) {
  // Guard against NaN / undefined rate
  const safeRate  = (typeof hourlyRate === 'number' && !isNaN(hourlyRate)) ? hourlyRate : 0;
  const totalMs   = Math.max(0, endTime.getTime() - startTime.getTime());
  const totalMins = totalMs / 60000;
  const fee = Math.round(safeRate * totalMins / 60);
  const svc = Math.round(fee * 0.1);
  return { mins: Math.ceil(totalMins), fee, svc, total: fee + svc };
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  // Simplified flat-earth distance in km
  const dlat = (lat2 - lat1) * 111;
  const dlng = (lng2 - lng1) * 111 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

function fmtDist(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function fmtClock(date: Date | null): string {
  if (!date) return '--:--';
  return date.toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtMins(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString('en-NP', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// Data captured when a session is stopped — used to generate the final receipt
interface FinalReceiptData {
  sessionId:     string;
  qrToken:       string;
  zoneName:      string;
  zoneCode:      string;
  startTime:     Date;
  endTime:       Date;
  bookedMins:    number;   // what driver originally booked
  actualMins:    number;   // actual minutes parked
  hourlyRate:    number;
  actualFee:     number;
  actualSvc:     number;
  actualTotal:   number;
  bookedTotal:   number;   // what was pre-paid
  paymentMethod: string;
  vehicleType:   string;
  plate:         string;
}

// ── PDF receipt HTML builder ──────────────────────────────────────────────────
function buildReceiptHTML(r: FinalReceiptData, pmLabel: string, vLabel: string): string {
  const refund        = r.bookedTotal - r.actualTotal;
  const earlyCheckout = refund > 0;

  const row = (label: string, value: string) =>
    `<tr><td class="lbl">${label}</td><td class="val">${value}</td></tr>`;

  const refundBlock = earlyCheckout
    ? `<div class="refund-box">
        <span class="refund-label">Refund / Wallet Credit</span>
        <span class="refund-value">Rs ${refund}</span>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #F5F6FA;
      padding: 24px;
      color: #111118;
    }

    /* ── Header ── */
    .header {
      background: #6B2FA0;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      color: white;
      margin-bottom: 20px;
    }
    .header h1 { font-size: 22px; font-weight: 800; }
    .header p  { font-size: 12px; opacity: 0.85; margin-top: 4px; }
    .paid-badge {
      display: inline-block;
      background: #00A651;
      color: white;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 12px;
      border-radius: 20px;
      margin-top: 10px;
      letter-spacing: 1px;
    }

    /* ── Card ── */
    .card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
    }
    .card-title {
      font-size: 11px;
      font-weight: 700;
      color: #9090A0;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      margin-bottom: 12px;
    }

    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; }
    tr { border-bottom: 1px solid #F2F2F7; }
    tr:last-child { border-bottom: none; }
    td { padding: 7px 0; vertical-align: top; }
    td.lbl { color: #9090A0; font-size: 12px; width: 48%; }
    td.val { color: #111118; font-size: 12px; font-weight: 600; text-align: right; }

    /* ── Dashed divider ── */
    .dashed { border: none; border-top: 2px dashed #E8E8EE; margin: 16px 0; }

    /* ── Total block ── */
    .total-box {
      background: #F3EDFB;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 12px 0;
    }
    .total-box .total-label { color: #6B2FA0; font-size: 13px; font-weight: 700; }
    .total-box .total-value { color: #6B2FA0; font-size: 22px; font-weight: 800; }

    /* ── Refund block ── */
    .refund-box {
      background: #E6F7EE;
      border-radius: 8px;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .refund-label { color: #00A651; font-size: 13px; font-weight: 600; }
    .refund-value { color: #00A651; font-size: 15px; font-weight: 800; }

    /* ── Mono IDs ── */
    .mono { font-family: 'Courier New', Courier, monospace; font-size: 11px; word-break: break-all; }

    /* ── Footer ── */
    .footer {
      text-align: center;
      color: #9090A0;
      font-size: 11px;
      margin-top: 8px;
      line-height: 1.8;
    }
    .footer strong { color: #6B2FA0; }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <h1>🅿 Nepal Smart Parking</h1>
    <p>Official Parking Receipt</p>
    <div class="paid-badge">✓ PAID</div>
  </div>

  <!-- Session details -->
  <div class="card">
    <div class="card-title">Session Details</div>
    <table>
      ${row('Zone', `${r.zoneName} (${r.zoneCode})`)}
      ${row('Started', fmtDateTime(r.startTime))}
      ${row('Ended', fmtDateTime(r.endTime))}
      ${row('Booked duration', fmtMins(r.bookedMins))}
      ${row('Actual time parked', fmtMins(r.actualMins))}
      ${row('Vehicle', vLabel)}
      ${row('Plate No.', r.plate)}
      ${row('Rate', `Rs ${r.hourlyRate}/hr`)}
    </table>
  </div>

  <!-- Cost breakdown -->
  <div class="card">
    <div class="card-title">Cost Breakdown</div>
    <table>
      ${row('Parking fee', `Rs ${r.actualFee}`)}
      ${row('Service fee (10%)', `Rs ${r.actualSvc}`)}
      ${row('Pre-paid amount', `Rs ${r.bookedTotal}`)}
      ${row('Payment via', pmLabel)}
    </table>
    <hr class="dashed"/>

    <!-- Actual total (purple) -->
    <div class="total-box">
      <span class="total-label">ACTUAL TOTAL</span>
      <span class="total-value">Rs ${r.actualTotal}</span>
    </div>

    <!-- Refund (green, only if early checkout) -->
    ${refundBlock}
  </div>

  <!-- Receipt identifiers -->
  <div class="card">
    <div class="card-title">Receipt Info</div>
    <table>
      ${row('Receipt No.', `<span class="mono">${r.sessionId}</span>`)}
      ${row('Session QR', `<span class="mono">${r.qrToken}</span>`)}
    </table>
  </div>

  <!-- Footer -->
  <div class="footer">
    <strong>Nepal Smart Parking</strong><br/>
    helpdesk@nepalsmsartparking.com<br/>
    Thank you for parking with NSP!
  </div>

</body>
</html>`;
}

// ── zone type config ──────────────────────────────────────────────────────────
export const ZONE_CONFIG: Record<ZoneType, { color: string; icon: string; label: string; badgeBg: string; badgeText: string }> = {
  standard: { color: '#1A56DB',  icon: 'alpha-p-box',    label: 'Paid',    badgeBg: '#EBF3FF', badgeText: '#1A56DB' },
  free:     { color: '#0077CC',  icon: 'alpha-b-box',    label: 'BLA',     badgeBg: '#E3F0FF', badgeText: '#0055AA' },
  private:  { color: '#111118',  icon: 'alpha-p-box',    label: 'Private', badgeBg: '#EBEBEB', badgeText: '#111118' },
  electric: { color: '#00A651',  icon: 'lightning-bolt', label: 'EV',      badgeBg: Colors.greenLight, badgeText: Colors.green },
};

function occupancyColor(pct: number) {
  if (pct >= 95) return Colors.red;
  if (pct >= 70) return Colors.orange;
  return Colors.green;
}

async function sendFreeParkingNotification(zoneName: string, limitMins?: number) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🅿️ Free Parking Started',
      body: limitMins
        ? `You have ${limitMins < 60 ? `${limitMins} min` : `${limitMins / 60}h`} of free parking at ${zoneName}`
        : `Enjoy free parking at ${zoneName}`,
      sound: true,
    },
    trigger: null,
  });
}

// ── Circular ring timer ───────────────────────────────────────────────────────
const RING_SIZE  = 180;
const RING_R     = 76;
const RING_SW    = 10;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

function CircularTimer({ elapsed, capMs, color, bookedTotal, rate }: {
  elapsed: number; capMs: number | null; color: string; bookedTotal: number; rate: number;
}) {
  const cycleMs  = 60 * 60000;
  const progress = capMs !== null
    ? Math.min(1, elapsed / (elapsed + Math.max(0, capMs)))
    : (elapsed % cycleMs) / cycleMs;
  const offset = CIRCUMFERENCE * (1 - progress);
  return (
    <View style={circStyles.wrap}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle cx={RING_SIZE/2} cy={RING_SIZE/2} r={RING_R} stroke={Colors.borderLight} strokeWidth={RING_SW} fill="none" />
        <Circle cx={RING_SIZE/2} cy={RING_SIZE/2} r={RING_R} stroke={color} strokeWidth={RING_SW} fill="none"
          strokeDasharray={`${CIRCUMFERENCE}`} strokeDashoffset={offset} strokeLinecap="round"
          rotation="-90" origin={`${RING_SIZE/2}, ${RING_SIZE/2}`} />
      </Svg>
      <View style={circStyles.center}>
        <Text style={[circStyles.time, { color }]}>{fmtElapsed(elapsed)}</Text>
        <Text style={circStyles.costValue}>Rs {bookedTotal}</Text>
        <Text style={circStyles.rateLabel}>@ Rs {rate}/hr (booked)</Text>
      </View>
    </View>
  );
}
const circStyles = StyleSheet.create({
  wrap:      { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  center:    { position: 'absolute', alignItems: 'center' },
  time:      { fontSize: 28, fontWeight: '800', letterSpacing: 1 },
  costValue: { fontSize: 18, fontWeight: '800', color: Colors.text, marginTop: 2 },
  rateLabel: { fontSize: 10, color: Colors.muted, marginTop: 1 },
});

// ── Zone list row (shared between search modal and main sheet) ────────────────
function ZoneRow({ zone, onPress, distKm, last }: {
  zone: Zone; onPress: () => void; distKm?: number; last?: boolean;
}) {
  const cfg    = ZONE_CONFIG[zone.type];
  const isFull = zone.occupancyPercent >= 95;
  return (
    <TouchableOpacity
      style={[zoneRowStyles.row, last && { borderBottomWidth: 0 }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[zoneRowStyles.badge, { backgroundColor: cfg.color }]}>
        <Icon name={cfg.icon as any} size={16} color={Colors.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={zoneRowStyles.name} numberOfLines={1}>{zone.name}</Text>
        <Text style={zoneRowStyles.sub}>
          {cfg.label}
          {zone.type === 'private' ? ` · ${zone.privateOperator}` : ` · ${zone.city}`}
          {distKm !== undefined ? `  ·  ${fmtDist(distKm)}` : ''}
        </Text>
      </View>
      <View style={zoneRowStyles.right}>
        {isFull
          ? <View style={zoneRowStyles.fullTag}><Text style={zoneRowStyles.fullText}>Full</Text></View>
          : <Text style={[zoneRowStyles.spots, { color: occupancyColor(zone.occupancyPercent) }]}>
              {zone.availableSpots} free
            </Text>
        }
        <Icon name="chevron-right" size={16} color={Colors.border} />
      </View>
    </TouchableOpacity>
  );
}
const zoneRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  badge: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  name:  { fontSize: 15, fontWeight: '600', color: Colors.text },
  sub:   { fontSize: 12, color: Colors.muted, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fullTag: { backgroundColor: Colors.redLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  fullText: { fontSize: 11, fontWeight: '700', color: Colors.red },
  spots: { fontSize: 12, fontWeight: '700' },
});

// ── component ─────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets  = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { user, activeSession, setActiveSession, extendSession } = useStore();
  const mapRef  = useRef<MapView>(null);

  // map / zone
  const [location,     setLocation]     = useState({ lat: 27.7048, lng: 85.3132 });
  const [selectedZone, setSelectedZone] = useState(mockZones[0]);
  // payment (used in stop modal)
  const [payMethod, setPayMethod] = useState<PMId>('esewa');
  const [starting,  setStarting]  = useState(false);

  // stop modal
  const [stopModal,    setStopModal]    = useState(false);
  const [stopping,     setStopping]     = useState(false);
  const [finalReceipt, setFinalReceipt] = useState<FinalReceiptData | null>(null);

  // ── Search modal state ───────────────────────────────────────────────────
  const [searchModal,   setSearchModal]   = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);   // zone codes

  // ── Hamburger menu modal ─────────────────────────────────────────────────
  const [menuModal, setMenuModal] = useState(false);

  // ── Real-time zone data (simulates live occupancy updates) ───────────────
  const [liveZones, setLiveZones] = useState(() => mockZones.map(z => ({ ...z })));
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Simulate live data: refresh occupancy every 30 s
  useEffect(() => {
    const t = setInterval(() => {
      setLiveZones(prev => prev.map(z => {
        if (!z.totalSpots) return z;
        const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2 vehicles
        const avail = Math.max(0, Math.min(z.totalSpots, z.availableSpots + delta));
        const pct   = Math.round((1 - avail / z.totalSpots) * 100);
        return { ...z, availableSpots: avail, occupancyPercent: pct };
      }));
      setLastUpdated(new Date());
    }, 30000);
    return () => clearInterval(t);
  }, []);

  // live clock
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load search history from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then(raw => {
      if (raw) setSearchHistory(JSON.parse(raw));
    });
  }, []);

  // Location auto-detect
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lng: longitude });
        mapRef.current?.animateToRegion({
          latitude, longitude,
          latitudeDelta: 0.02, longitudeDelta: 0.02,
        });
        const nearest = [...liveZones].sort((a, b) =>
          distanceKm(latitude, longitude, a.latitude, a.longitude) -
          distanceKm(latitude, longitude, b.latitude, b.longitude)
        )[0];
        if (nearest) setSelectedZone(nearest);
      } catch { /* keep default Kathmandu coords */ }
    })();
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────
  const zonesSortedByDist = useMemo(() =>
    [...liveZones].sort((a, b) =>
      distanceKm(location.lat, location.lng, a.latitude, a.longitude) -
      distanceKm(location.lat, location.lng, b.latitude, b.longitude)
    ), [liveZones, location]);

  const nearestZone = zonesSortedByDist[0];

  const filteredZones = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return zonesSortedByDist;
    return zonesSortedByDist.filter(z =>
      z.name.toLowerCase().includes(q) ||
      z.code.toLowerCase().includes(q) ||
      z.city.toLowerCase().includes(q) ||
      ZONE_CONFIG[z.type].label.toLowerCase().includes(q),
    );
  }, [searchQuery, zonesSortedByDist]);

  const historyZones = useMemo(() =>
    searchHistory
      .map(code => liveZones.find(z => z.code === code))
      .filter(Boolean) as Zone[],
    [searchHistory, liveZones]);

  // ── Save zone to search history ───────────────────────────────────────────
  const addToHistory = useCallback(async (code: string) => {
    const updated = [code, ...searchHistory.filter(c => c !== code)].slice(0, MAX_HISTORY);
    setSearchHistory(updated);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  }, [searchHistory]);

  // ── Select zone — navigate to full-screen ZoneDetail (EasyPark style) ──────
  const selectZone = useCallback((zone: Zone) => {
    setSelectedZone(zone);
    mapRef.current?.animateToRegion({
      latitude: zone.latitude, longitude: zone.longitude,
      latitudeDelta: 0.012, longitudeDelta: 0.012,
    });
    addToHistory(zone.code);
    setSearchModal(false);
    setSearchQuery('');
    // Navigate to the full-screen time-picker (ZoneDetailScreen)
    navigation.navigate('ZoneDetail', { zoneCode: zone.code });
  }, [addToHistory, navigation]);

  const handleStop = async () => {
    if (!activeSession) return;
    setStopping(true);

    // Capture actual cost at the moment of stopping (may be less than booked if early checkout)
    const endTime  = new Date();
    const actual   = calcCost(activeSession.startTime, endTime, activeSession.hourlyRate);
    const pv       = user ? primaryVehicle(user) : undefined;

    try { await sessionsAPI.stop(activeSession.sessionId); } catch { }

    // Build final receipt before clearing the session from the store
    setFinalReceipt({
      sessionId:     activeSession.sessionId,
      qrToken:       activeSession.qrToken,
      zoneName:      activeSession.zoneName,
      zoneCode:      activeSession.zoneCode,
      startTime:     activeSession.startTime,
      endTime,
      bookedMins:    activeSession.durationMinutes,
      actualMins:    actual.mins,
      hourlyRate:    activeSession.hourlyRate,
      actualFee:     actual.fee,
      actualSvc:     actual.svc,
      actualTotal:   actual.total,
      bookedTotal:   activeSession.totalPaid,
      paymentMethod: activeSession.paymentMethod,
      vehicleType:   activeSession.vehicleType,
      plate:         pv?.plateNumber ?? '—',
    });

    setActiveSession(null);
    setStopModal(false);
    setStopping(false);
  };

  // ── Live session maths ────────────────────────────────────────────────────
  const elapsed  = activeSession ? now - activeSession.startTime.getTime() : 0;
  const liveCost = activeSession ? calcCost(activeSession.startTime, new Date(now), activeSession.hourlyRate) : null;
  const capMs    = activeSession?.endTimeCap ? activeSession.endTimeCap.getTime() - now : null;
  const nearingCap = capMs !== null && capMs > 0 && capMs < 10 * 60000;
  const pastCap    = capMs !== null && capMs <= 0;
  const timerColor = pastCap ? Colors.red : nearingCap ? Colors.orange : Colors.green;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Full-screen map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: location.lat, longitude: location.lng,
          latitudeDelta: 0.025, longitudeDelta: 0.025,
        }}
      >
        <Marker coordinate={{ latitude: location.lat, longitude: location.lng }}>
          <View style={styles.youDot}><View style={styles.youDotInner} /></View>
        </Marker>
        {liveZones.map(z => {
          const cfg      = ZONE_CONFIG[z.type];
          const isFull   = z.occupancyPercent >= 95;
          const isSelected = selectedZone.code === z.code;
          const pinBg    = isFull ? Colors.red : cfg.color;
          return (
            <Marker key={z.code}
              coordinate={{ latitude: z.latitude, longitude: z.longitude }}
              onPress={() => selectZone(z)}
              tracksViewChanges={false}
            >
              {/* EasyPark-style flat sign marker */}
              <View style={[
                styles.signPin,
                { backgroundColor: pinBg },
                isSelected && styles.signPinSelected,
              ]}>
                <Icon name={cfg.icon as any} size={isSelected ? 18 : 15} color={Colors.white} />
                {/* Small tail */}
                <View style={[styles.signTail, { borderTopColor: pinBg }]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* ── Floating top bar ── */}
      <View style={[styles.topBar, { marginTop: insets.top + 8 }]}>
        {/* 🔍 Search */}
        <TouchableOpacity style={styles.mapFab} onPress={() => setSearchModal(true)}>
          <Icon name="magnify" size={22} color={Colors.text} />
        </TouchableOpacity>
        {/* ≡ Hamburger */}
        <TouchableOpacity style={styles.mapFab} onPress={() => setMenuModal(true)}>
          <Icon name="menu" size={22} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* EV filter */}
      <View style={[styles.evFabWrap, { top: insets.top + 64 }]}>
        <TouchableOpacity style={styles.evFab}
          onPress={() => { const ev = liveZones.find(z => z.type === 'electric'); if (ev) selectZone(ev); }}>
          <Icon name="lightning-bolt" size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Locate me — sits above the bottom sheet (≈ 260 from bottom of sheet area) */}
      <TouchableOpacity
        style={[styles.locateBtn, { bottom: 290 + insets.bottom }]}
        onPress={() => mapRef.current?.animateToRegion({
          latitude: location.lat, longitude: location.lng,
          latitudeDelta: 0.015, longitudeDelta: 0.015,
        })}
      >
        <Icon name="crosshairs-gps" size={20} color={Colors.primary} />
      </TouchableOpacity>

      {/* ═══════════ BOTTOM SHEET ═══════════ */}
      {activeSession ? (
        /* ── ACTIVE SESSION ── */
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sessionTopRow}>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <Text style={styles.sessionZoneName} numberOfLines={1}>{activeSession.zoneName}</Text>
            <View style={styles.zoneCodePill}>
              <Text style={styles.zoneCodeText}>{activeSession.zoneCode}</Text>
            </View>
          </View>

          <CircularTimer elapsed={elapsed} capMs={capMs} color={timerColor}
            bookedTotal={activeSession.totalPaid} rate={activeSession.hourlyRate ?? 0} />

          {nearingCap && (
            <View style={[styles.alertBanner, { backgroundColor: Colors.orangeLight }]}>
              <Icon name="clock-alert-outline" size={14} color={Colors.orange} />
              <Text style={[styles.alertText, { color: Colors.orange }]}>Approaching your set end time</Text>
            </View>
          )}
          {pastCap && (
            <View style={[styles.alertBanner, { backgroundColor: Colors.redLight }]}>
              <Icon name="alert-circle-outline" size={14} color={Colors.red} />
              <Text style={[styles.alertText, { color: Colors.red }]}>Past your planned end time — please stop now</Text>
            </View>
          )}
          {activeSession.endTimeCap && !pastCap && (
            <Text style={styles.capLabel}>Planned until {fmtClock(activeSession.endTimeCap)}</Text>
          )}

          <View style={styles.sessionActions}>
            <TouchableOpacity style={styles.extendBtn} onPress={() => extendSession(30)}>
              <Icon name="clock-plus-outline" size={16} color={Colors.primary} />
              <Text style={styles.extendBtnText}>+30m</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.extendBtn} onPress={() => extendSession(60)}>
              <Icon name="clock-plus-outline" size={16} color={Colors.primary} />
              <Text style={styles.extendBtnText}>+1h</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stopBtn} onPress={() => setStopModal(true)}>
              <Icon name="stop-circle" size={18} color={Colors.white} />
              <Text style={styles.stopBtnText}>Stop & Pay</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* ── SELECT AREA bottom sheet ── */
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.sheetHandle} />

          {/* Title row */}
          <View style={styles.selectAreaHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>Select area</Text>
              <Text style={styles.gpsNote}>Your GPS position might be uncertain</Text>
            </View>
            <TouchableOpacity style={styles.infoBtn}>
              <Icon name="information-outline" size={20} color={Colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Nearest zone card */}
          {nearestZone && (() => {
            const cfg    = ZONE_CONFIG[nearestZone.type];
            const isFull = nearestZone.occupancyPercent >= 95;
            const dist   = distanceKm(location.lat, location.lng, nearestZone.latitude, nearestZone.longitude);
            const code   = nearestZone.code.replace('Z-', '');
            const typeLabel = nearestZone.type === 'free' ? 'Surface Lot'
              : nearestZone.type === 'electric' ? 'EV Charging Station'
              : nearestZone.type === 'private'  ? 'Private Parking'
              : 'Surface Lot';
            const operator = nearestZone.type === 'private'
              ? nearestZone.privateOperator ?? 'Private'
              : 'NSP';

            return (
              <TouchableOpacity
                style={styles.nearestCard}
                onPress={() => selectZone(nearestZone)}
                activeOpacity={0.85}
              >
                <View style={[styles.nearestSignBadge, { backgroundColor: cfg.color }]}>
                  <Icon name={cfg.icon as any} size={20} color={Colors.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nearestCode}>{code}</Text>
                  <Text style={styles.nearestName} numberOfLines={1}>{nearestZone.name}</Text>
                  <Text style={styles.nearestSub}>{typeLabel} · {operator} · {fmtDist(dist)}</Text>
                  <View style={styles.nearestAvailRow}>
                    <View style={[styles.availDot, { backgroundColor: occupancyColor(nearestZone.occupancyPercent) }]} />
                    <Text style={[styles.nearestAvailText, { color: occupancyColor(nearestZone.occupancyPercent) }]}>
                      {isFull ? 'Full' : `${nearestZone.availableSpots} of ${nearestZone.totalSpots} free`}
                    </Text>
                    <View style={styles.liveMiniPill}>
                      <View style={styles.liveMiniDot} />
                      <Text style={styles.liveMiniText}>Live</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity style={styles.cardInfoBtn} onPress={(e) => {
                  e.stopPropagation();
                  Alert.alert(
                    nearestZone.name,
                    `Zone: ${nearestZone.code}\nCity: ${nearestZone.city}\nType: ${cfg.label}\nTotal spots: ${nearestZone.totalSpots}\nAvailable: ${nearestZone.availableSpots}\nRate (car): Rs ${nearestZone.rate4w}/hr`,
                  );
                }}>
                  <View style={styles.cardInfoCircle}>
                    <Icon name="information-outline" size={18} color={Colors.muted} />
                  </View>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })()}

          <Text style={styles.updatedText}>
            Updated {lastUpdated.toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </Text>

          <TouchableOpacity style={styles.searchAllBtn} onPress={() => setSearchModal(true)}>
            <Icon name="magnify" size={16} color={Colors.primary} />
            <Text style={styles.searchAllText}>Search all parking areas</Text>
            <Icon name="chevron-right" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* ═══════════ SEARCH MODAL ═══════════ */}
      <Modal visible={searchModal} animationType="slide" onRequestClose={() => { setSearchModal(false); setSearchQuery(''); }}>
        <View style={[searchStyles.root, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={searchStyles.header}>
            <TouchableOpacity onPress={() => { setSearchModal(false); setSearchQuery(''); }} style={searchStyles.closeBtn}>
              <Icon name="arrow-left" size={22} color={Colors.text} />
            </TouchableOpacity>
            <View style={searchStyles.inputWrap}>
              <Icon name="magnify" size={18} color={Colors.muted} />
              <TextInput
                style={searchStyles.input}
                placeholder="Search parking areas, zones…"
                placeholderTextColor={Colors.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Icon name="close-circle" size={18} color={Colors.muted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <FlatList
            data={filteredZones}
            keyExtractor={z => z.code}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <>
                {/* Recent searches */}
                {searchQuery.length === 0 && historyZones.length > 0 && (
                  <View>
                    <View style={searchStyles.sectionHeader}>
                      <Icon name="history" size={14} color={Colors.muted} />
                      <Text style={searchStyles.sectionTitle}>Recent</Text>
                      <TouchableOpacity onPress={async () => {
                        setSearchHistory([]);
                        await AsyncStorage.removeItem(HISTORY_KEY);
                      }}>
                        <Text style={searchStyles.clearText}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                    {historyZones.map((z, i) => (
                      <ZoneRow
                        key={z.code} zone={z}
                        distKm={distanceKm(location.lat, location.lng, z.latitude, z.longitude)}
                        onPress={() => selectZone(z)}
                        last={i === historyZones.length - 1}
                      />
                    ))}
                    <View style={searchStyles.divider} />
                  </View>
                )}

                {/* All areas header */}
                <View style={searchStyles.sectionHeader}>
                  <Icon name="map-marker-multiple-outline" size={14} color={Colors.muted} />
                  <Text style={searchStyles.sectionTitle}>
                    {searchQuery ? `Results (${filteredZones.length})` : 'All Parking Areas'}
                  </Text>
                </View>
              </>
            }
            renderItem={({ item: z, index }) => (
              <ZoneRow
                zone={z}
                distKm={distanceKm(location.lat, location.lng, z.latitude, z.longitude)}
                onPress={() => selectZone(z)}
                last={index === filteredZones.length - 1}
              />
            )}
            ListEmptyComponent={
              <View style={searchStyles.empty}>
                <Icon name="map-search-outline" size={44} color={Colors.border} />
                <Text style={searchStyles.emptyText}>No zones match "{searchQuery}"</Text>
              </View>
            }
          />
        </View>
      </Modal>

      {/* ═══════════ HAMBURGER MENU MODAL ═══════════ */}
      <Modal visible={menuModal} transparent animationType="fade" onRequestClose={() => setMenuModal(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuModal(false)}>
          <View style={[styles.menuSheet, { paddingTop: insets.top + 8 }]}>
            {/* User info */}
            {user && (
              <View style={styles.menuUserRow}>
                <View style={styles.menuAvatar}>
                  <Text style={styles.menuAvatarText}>
                    {user.fullName.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={styles.menuUserName}>{user.fullName}</Text>
                  <Text style={styles.menuUserSub}>{user.nationalId}</Text>
                </View>
              </View>
            )}
            <View style={styles.menuDivider} />
            {[
              { icon: 'account-circle-outline', label: 'Profile',         action: () => { setMenuModal(false); (navigation as any).navigate('Main', { screen: 'Profile' }); } },
              { icon: 'car-multiple',           label: 'My Vehicles',     action: () => { setMenuModal(false); navigation.navigate('Vehicles'); } },
              { icon: 'history',                label: 'Parking History', action: () => { setMenuModal(false); (navigation as any).navigate('Main', { screen: 'History' }); } },
              { icon: 'wallet-outline',         label: 'Wallet',          action: () => { setMenuModal(false); (navigation as any).navigate('Main', { screen: 'Wallet' }); } },
            ].map(item => (
              <TouchableOpacity key={item.label} style={styles.menuItem} onPress={item.action}>
                <Icon name={item.icon as any} size={20} color={Colors.primary} />
                <Text style={styles.menuItemText}>{item.label}</Text>
                <Icon name="chevron-right" size={18} color={Colors.border} />
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ═══════════ FINAL RECEIPT MODAL ═══════════ */}
      <Modal
        visible={finalReceipt !== null}
        animationType="slide"
        transparent
        onRequestClose={() => {/* block hardware back */}}
      >
        {finalReceipt && (() => {
          const refund        = finalReceipt.bookedTotal - finalReceipt.actualTotal;
          const earlyCheckout = refund > 0;
          const pmLabel       = PAYMENT_METHODS.find(m => m.id === finalReceipt.paymentMethod)?.label ?? finalReceipt.paymentMethod;
          const vLabel        = finalReceipt.vehicleType === '4w' ? 'Car / SUV' : 'Motorcycle';

          const downloadPDF = async () => {
            try {
              const html    = buildReceiptHTML(finalReceipt, pmLabel, vLabel);
              const { uri } = await Print.printToFileAsync({
                html,
                base64: false,
              });
              // Rename to a friendly filename by copying (expo-print uses a temp path)
              const canShare = await Sharing.isAvailableAsync();
              if (canShare) {
                await Sharing.shareAsync(uri, {
                  mimeType:    'application/pdf',
                  dialogTitle: 'NSP Parking Receipt',
                  UTI:         'com.adobe.pdf',
                });
              } else {
                Alert.alert('Saved', `Receipt saved to: ${uri}`);
              }
            } catch (err) {
              Alert.alert('Error', 'Could not generate PDF. Please try again.');
            }
          };

          return (
            <View style={rcptStyles.overlay}>
              <View style={[rcptStyles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>

                {/* Success badge */}
                <View style={rcptStyles.successBadge}>
                  <View style={rcptStyles.successCircle}>
                    <Icon name="check-bold" size={32} color={Colors.white} />
                  </View>
                  <Text style={rcptStyles.successTitle}>Payment Confirmed!</Text>
                  <Text style={rcptStyles.successSub}>
                    {earlyCheckout
                      ? `Rs ${refund} will be refunded / credited to your wallet`
                      : 'Your parking session has ended.'}
                  </Text>
                </View>

                {/* Receipt card */}
                <ScrollView
                  style={rcptStyles.scroll}
                  contentContainerStyle={rcptStyles.scrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={rcptStyles.card}>
                    {/* Letterhead */}
                    <View style={rcptStyles.letterhead}>
                      <View style={rcptStyles.letterheadIcon}>
                        <Icon name="alpha-p-box" size={22} color={Colors.white} />
                      </View>
                      <View>
                        <Text style={rcptStyles.letterheadTitle}>Nepal Smart Parking</Text>
                        <Text style={rcptStyles.letterheadSub}>Parking Receipt</Text>
                      </View>
                    </View>
                    <View style={rcptStyles.dashed} />

                    {[
                      { label: 'Zone',     value: `${finalReceipt.zoneName}  (${finalReceipt.zoneCode})` },
                      { label: 'Started',  value: fmtDateTime(finalReceipt.startTime) },
                      { label: 'Ended',    value: fmtDateTime(finalReceipt.endTime) },
                      { label: 'Booked',   value: fmtMins(finalReceipt.bookedMins) },
                      { label: 'Parked',   value: fmtMins(finalReceipt.actualMins) },
                      { label: 'Vehicle',  value: vLabel },
                      { label: 'Plate',    value: finalReceipt.plate },
                      { label: 'Rate',     value: `Rs ${finalReceipt.hourlyRate}/hr` },
                    ].map(r => (
                      <View key={r.label} style={rcptStyles.row}>
                        <Text style={rcptStyles.rowLabel}>{r.label}</Text>
                        <Text style={rcptStyles.rowValue}>{r.value}</Text>
                      </View>
                    ))}

                    <View style={rcptStyles.dashed} />

                    <View style={rcptStyles.row}>
                      <Text style={rcptStyles.rowLabel}>Parking fee</Text>
                      <Text style={rcptStyles.rowValue}>Rs {finalReceipt.actualFee}</Text>
                    </View>
                    <View style={rcptStyles.row}>
                      <Text style={rcptStyles.rowLabel}>Service fee (10%)</Text>
                      <Text style={rcptStyles.rowValue}>Rs {finalReceipt.actualSvc}</Text>
                    </View>

                    {/* Total row */}
                    <View style={rcptStyles.totalRow}>
                      <Text style={rcptStyles.totalLabel}>ACTUAL TOTAL</Text>
                      <Text style={rcptStyles.totalValue}>Rs {finalReceipt.actualTotal}</Text>
                    </View>

                    <View style={rcptStyles.row}>
                      <Text style={rcptStyles.rowLabel}>Pre-paid</Text>
                      <Text style={rcptStyles.rowValue}>Rs {finalReceipt.bookedTotal}</Text>
                    </View>

                    {earlyCheckout && (
                      <View style={[rcptStyles.row, rcptStyles.refundRow]}>
                        <Text style={[rcptStyles.rowLabel, { color: Colors.green }]}>Refund / credit</Text>
                        <Text style={[rcptStyles.rowValue, { color: Colors.green, fontWeight: '800' }]}>Rs {refund}</Text>
                      </View>
                    )}

                    <View style={rcptStyles.row}>
                      <Text style={rcptStyles.rowLabel}>Payment via</Text>
                      <Text style={rcptStyles.rowValue}>{pmLabel}</Text>
                    </View>

                    <View style={rcptStyles.dashed} />

                    <View style={rcptStyles.row}>
                      <Text style={rcptStyles.rowLabel}>Receipt No.</Text>
                      <Text style={[rcptStyles.rowValue, rcptStyles.mono]} numberOfLines={1} ellipsizeMode="middle">
                        {finalReceipt.sessionId}
                      </Text>
                    </View>
                    <View style={rcptStyles.row}>
                      <Text style={rcptStyles.rowLabel}>Session QR</Text>
                      <Text style={[rcptStyles.rowValue, rcptStyles.mono]} numberOfLines={1} ellipsizeMode="middle">
                        {finalReceipt.qrToken}
                      </Text>
                    </View>

                    <View style={rcptStyles.dashed} />
                    <Text style={rcptStyles.thankYou}>Thank you for using NSP!</Text>
                    <Text style={rcptStyles.helpdesk}>helpdesk@nepalsmsartparking.com</Text>
                  </View>
                </ScrollView>

                {/* Buttons */}
                <View style={rcptStyles.actions}>
                  <TouchableOpacity style={rcptStyles.downloadBtn} onPress={downloadPDF} activeOpacity={0.8}>
                    <Icon name="download-outline" size={18} color={Colors.primary} />
                    <Text style={rcptStyles.downloadBtnText}>Download Receipt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={rcptStyles.doneBtn}
                    onPress={() => setFinalReceipt(null)}
                    activeOpacity={0.85}
                  >
                    <Icon name="check" size={18} color={Colors.white} />
                    <Text style={rcptStyles.doneBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>

              </View>
            </View>
          );
        })()}
      </Modal>

      {/* ═══════════ STOP & PAY MODAL ═══════════ */}
      <Modal visible={stopModal} transparent animationType="slide" onRequestClose={() => setStopModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Stop Parking</Text>
            {activeSession && liveCost && (() => {
              const refund = activeSession.totalPaid - liveCost.total;
              const earlyCheckout = refund > 0;
              return (
                <>
                  <View style={styles.summaryCard}>
                    {/* Actual usage */}
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Zone</Text>
                      <Text style={styles.summaryValue}>{activeSession.zoneName}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Time parked</Text>
                      <Text style={styles.summaryValue}>{fmtElapsed(elapsed)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Parking fee</Text>
                      <Text style={styles.summaryValue}>Rs {liveCost.fee}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Service fee (10%)</Text>
                      <Text style={styles.summaryValue}>Rs {liveCost.svc}</Text>
                    </View>

                    {/* Booked vs actual divider */}
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Pre-paid (booked {fmtMins(activeSession.durationMinutes)})</Text>
                      <Text style={styles.summaryValue}>Rs {activeSession.totalPaid}</Text>
                    </View>

                    {/* Actual total */}
                    <View style={[styles.summaryRow, styles.summaryTotal]}>
                      <Text style={styles.summaryTotalLabel}>Actual total</Text>
                      <Text style={styles.summaryTotalValue}>Rs {liveCost.total}</Text>
                    </View>

                    {/* Refund row (early checkout) */}
                    {earlyCheckout && (
                      <View style={[styles.summaryRow, styles.refundRow]}>
                        <View style={styles.refundBadge}>
                          <Icon name="arrow-down-circle-outline" size={14} color={Colors.green} />
                          <Text style={styles.refundLabel}>Refund / wallet credit</Text>
                        </View>
                        <Text style={styles.refundValue}>Rs {refund}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.pickerLabel}>Pay with</Text>
                  <View style={styles.paymentRow}>
                    {PAYMENT_METHODS.map(m => (
                      <TouchableOpacity key={m.id}
                        style={[styles.paymentChip, payMethod === m.id && { borderColor: m.color, backgroundColor: m.color + '15' }]}
                        onPress={() => setPayMethod(m.id)}
                      >
                        <Text style={[styles.paymentChipText, payMethod === m.id && { color: m.color, fontWeight: '700' }]}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.startBtn, stopping && styles.startBtnDisabled]}
                    onPress={handleStop} disabled={stopping}
                  >
                    {stopping ? <ActivityIndicator color={Colors.white} /> : (
                      <View style={styles.startBtnInner}>
                        <View>
                          <Text style={styles.startBtnLabel}>Confirm & Pay</Text>
                          <Text style={styles.startBtnSub}>Rs {liveCost.total} via {payMethod}</Text>
                        </View>
                        <View style={styles.startArrow}>
                          <Icon name="check" size={20} color={Colors.primary} />
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setStopModal(false)}>
                    <Text style={styles.cancelBtnText}>Cancel — keep parking</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Search modal styles ───────────────────────────────────────────────────────
const searchStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.light, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  input: { flex: 1, fontSize: 15, color: Colors.text },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  sectionTitle: { flex: 1, fontSize: 12, fontWeight: '700', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  clearText:    { fontSize: 12, fontWeight: '700', color: Colors.primary },
  divider:      { height: 8, backgroundColor: Colors.light },
  empty: { alignItems: 'center', gap: Spacing.sm, paddingTop: 60 },
  emptyText: { fontSize: 14, color: Colors.muted },
});

// ── Main styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light },

  topBar: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  mapFab: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  evFabWrap: { position: 'absolute', left: 16 },
  evFab: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.green,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },

  selectAreaHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.md },
  gpsNote:  { fontSize: 13, color: Colors.muted, marginTop: 2 },
  infoBtn:  { padding: 4, marginTop: 2 },

  // EasyPark-style nearest zone card
  nearestCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    backgroundColor: Colors.light, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  nearestSignBadge: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
  },
  nearestCode: { fontSize: 15, fontWeight: '800', color: Colors.text, marginBottom: 1 },
  nearestName: { fontSize: 13, color: Colors.text, marginBottom: 2 },
  nearestSub:  { fontSize: 11, color: Colors.muted, marginBottom: 5 },
  nearestAvailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  availDot:    { width: 7, height: 7, borderRadius: 4 },
  nearestAvailText: { fontSize: 12, fontWeight: '700' },

  // Live mini pill
  liveMiniPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.greenLight,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginLeft: 4,
  },
  liveMiniDot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.green },
  liveMiniText: { fontSize: 9, fontWeight: '800', color: Colors.green },

  // Info button on card
  cardInfoBtn:   { padding: 2, marginTop: 2 },
  cardInfoCircle:{ width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },

  updatedText: { fontSize: 11, color: Colors.muted, textAlign: 'right', marginBottom: Spacing.sm },

  // Search all link
  searchAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: Spacing.sm + 2, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  searchAllText: { fontSize: 14, fontWeight: '700', color: Colors.primary },

  youDot:      { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(107,47,160,0.2)', alignItems: 'center', justifyContent: 'center' },
  youDotInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary, borderWidth: 2, borderColor: Colors.white },

  // EasyPark flat sign pin
  signPin: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 4, elevation: 4,
  },
  signPinSelected: {
    width: 44, height: 44, borderRadius: 12,
    borderWidth: 2.5, borderColor: Colors.white,
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },
  signTail: {
    position: 'absolute', bottom: -5, alignSelf: 'center',
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },

  locateBtn: {
    position: 'absolute', right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },

  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    maxHeight: '85%',
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg, paddingTop: 8,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, elevation: 12,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 12,
  },
  sheetTitle:   { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  confirmScroll:{ paddingBottom: 8 },

  confirmHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  backChip: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  confirmNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  confirmZoneName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  confirmZoneCode: { fontSize: 11, color: Colors.muted, marginTop: 1 },
  occupancyPill:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  occupancyText:   { fontSize: 11, fontWeight: '700' },
  zoneTypeBadge:   { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  zoneTypeBadgeText: { fontSize: 10, fontWeight: '700' },

  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#E3F0FF', borderRadius: BorderRadius.sm,
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10,
  },
  infoBannerText: { fontSize: 12, fontWeight: '600', flex: 1 },

  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  vehicleBtn: {
    width: '48%', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.light,
  },
  vehicleBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  vehicleBtnLabel:  { fontSize: 12, fontWeight: '700', color: Colors.muted, textAlign: 'center' },
  vehicleBtnRate:   { fontSize: 11, color: Colors.muted },

  pickerLabel: { fontSize: 12, fontWeight: '700', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },

  // "Duration" header row + "Ends HH:MM" pill
  pickerHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 6,
  },
  endsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
  },
  endsText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  paymentRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  paymentChip: {
    flex: 1, paddingVertical: 9, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.light,
  },
  paymentChipText: { fontSize: 12, color: Colors.muted, fontWeight: '600' },

  startBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
    paddingVertical: 14, paddingHorizontal: 20, marginBottom: 4,
  },
  startBtnDisabled: { backgroundColor: Colors.muted },
  startBtnInner:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  startBtnLabel:    { fontSize: 16, fontWeight: '800', color: Colors.white },
  startBtnSub:      { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  startArrow: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
  },

  // Active session
  sessionTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.greenLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  liveDot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.green },
  liveText:       { fontSize: 11, fontWeight: '800', color: Colors.green, letterSpacing: 0.5 },
  sessionZoneName:{ flex: 1, fontSize: 14, fontWeight: '700', color: Colors.text },
  zoneCodePill:   { backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  zoneCodeText:   { fontSize: 10, fontWeight: '700', color: Colors.primary },
  capLabel:       { fontSize: 12, color: Colors.muted, textAlign: 'center', marginBottom: 8 },
  alertBanner:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: BorderRadius.sm, padding: 8, marginBottom: 10 },
  alertText:      { fontSize: 12, flex: 1 },
  sessionActions: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  extendBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 12, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  extendBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  stopBtn: {
    flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, backgroundColor: Colors.red, borderRadius: BorderRadius.md,
  },
  stopBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },

  // Hamburger menu
  menuOverlay: { flex: 1 },
  menuSheet: {
    position: 'absolute', top: 0, right: 0,
    width: 280,
    height: '100%',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, elevation: 16,
  },
  menuUserRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg },
  menuAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  menuAvatarText: { fontSize: 18, fontWeight: '800', color: Colors.white },
  menuUserName:   { fontSize: 15, fontWeight: '700', color: Colors.text },
  menuUserSub:    { fontSize: 11, color: Colors.muted, marginTop: 2 },
  menuDivider:    { height: 1, backgroundColor: Colors.border, marginBottom: Spacing.sm },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14,
  },
  menuItemText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },

  // Stop modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg, paddingTop: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 16 },
  summaryCard: {
    backgroundColor: Colors.light, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: 16,
  },
  summaryRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  summaryLabel:      { fontSize: 13, color: Colors.muted, flex: 1 },
  summaryValue:      { fontSize: 13, fontWeight: '600', color: Colors.text },
  summaryDivider:    { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  summaryTotal:      { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4, paddingTop: 10 },
  summaryTotalLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  summaryTotalValue: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  refundRow:         { backgroundColor: Colors.greenLight, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, marginTop: 4 },
  refundBadge:       { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  refundLabel:       { fontSize: 13, color: Colors.green, fontWeight: '600' },
  refundValue:       { fontSize: 13, fontWeight: '800', color: Colors.green },
  cancelBtn:         { alignItems: 'center', paddingVertical: 14 },
  cancelBtnText:     { fontSize: 14, color: Colors.muted, fontWeight: '600' },
});

// ── Final receipt modal styles ────────────────────────────────────────────────
const rcptStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.light,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: Spacing.lg, maxHeight: '92%',
  },

  // Success banner
  successBadge: { alignItems: 'center', paddingBottom: Spacing.lg },
  successCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: Colors.green, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.green, shadowOpacity: 0.35, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  successTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  successSub:   { fontSize: 13, color: Colors.muted, marginTop: 4, textAlign: 'center', paddingHorizontal: Spacing.xl },

  // Receipt card
  scroll:        { flexShrink: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  card: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  letterhead:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  letterheadIcon:  { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  letterheadTitle: { fontSize: 15, fontWeight: '800', color: Colors.text },
  letterheadSub:   { fontSize: 11, color: Colors.muted, marginTop: 1 },
  dashed: { borderStyle: 'dashed', borderWidth: 1, borderColor: Colors.border, marginVertical: Spacing.md },
  row:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  rowLabel:    { fontSize: 12, color: Colors.muted, flex: 1 },
  rowValue:    { fontSize: 12, fontWeight: '600', color: Colors.text, flex: 2, textAlign: 'right' },
  mono:        { fontFamily: 'Courier', fontSize: 11 },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm + 2, marginVertical: Spacing.sm,
  },
  totalLabel:  { fontSize: 13, fontWeight: '800', color: Colors.primary },
  totalValue:  { fontSize: 18, fontWeight: '800', color: Colors.primary },
  refundRow:   { backgroundColor: Colors.greenLight, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm },
  thankYou:    { fontSize: 12, color: Colors.muted, textAlign: 'center', marginTop: Spacing.xs },
  helpdesk:    { fontSize: 11, color: Colors.muted, textAlign: 'center', marginTop: 2 },

  // Buttons
  actions: {
    flexDirection: 'row', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
  },
  downloadBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2, backgroundColor: Colors.primaryLight,
  },
  downloadBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  doneBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
  },
  doneBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },
});
