import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, ActivityIndicator, Alert, ScrollView,
  KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import ClockTimePicker from '@/components/ClockTimePicker';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Notifications from 'expo-notifications';
import { Colors, Spacing, BorderRadius } from '@/utils/theme';
import { mockZones, sessionsAPI, Zone, ZoneType } from '@/services/api';
import { useStore } from '@/store/useStore';
import { RootStackParamList } from '@/navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Main'>;

const PAYMENT_METHODS = [
  { id: 'esewa',      label: 'eSewa',       color: '#60BB46' },
  { id: 'khalti',     label: 'Khalti',      color: '#5C2D91' },
  { id: 'connectips', label: 'ConnectIPS',  color: '#E84142' },
] as const;
type PMId = typeof PAYMENT_METHODS[number]['id'];

// ── helpers ──────────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, '0'); }

function fmtElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function fmtClock(d: Date) {
  return d.toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function calcCost(startTime: Date, endTime: Date, hourlyRate: number) {
  const mins = Math.ceil((endTime.getTime() - startTime.getTime()) / 60000);
  const fee  = Math.round(hourlyRate * mins / 60);
  const svc  = Math.round(fee * 0.1);
  return { mins, fee, svc, total: fee + svc };
}

// ── zone type config ──────────────────────────────────────────────────────────
export const ZONE_CONFIG: Record<ZoneType, { color: string; icon: string; label: string; badgeBg: string; badgeText: string }> = {
  standard: { color: Colors.primary,   icon: 'parking',          label: 'Paid',     badgeBg: Colors.primaryLight, badgeText: Colors.primary },
  free:     { color: '#0077CC',        icon: 'alpha-b-box',      label: 'BLA',      badgeBg: '#E3F0FF',           badgeText: '#0055AA'      },
  private:  { color: '#555E6E',        icon: 'shield-lock',      label: 'Private',  badgeBg: '#EBEBEB',           badgeText: '#333'         },
  electric: { color: '#00A651',        icon: 'lightning-bolt',   label: 'EV',       badgeBg: Colors.greenLight,   badgeText: Colors.green   },
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

// ── EasyPark-style time slot list ────────────────────────────────────────────
// Generates slots: Open + every 15 min up to 8 h from now
function buildTimeSlots(ratePerHour: number) {
  const now   = new Date();
  const slots: { key: string; label: string; sublabel: string; mins: number | null; cost: number | null }[] = [
    { key: 'open', label: 'Open', sublabel: 'Pay for time used', mins: null, cost: null },
  ];
  for (let m = 15; m <= 480; m += 15) {
    const end  = new Date(now.getTime() + m * 60000);
    const fee  = Math.round(ratePerHour * m / 60);
    const svc  = Math.round(fee * 0.1);
    const hh   = Math.floor(m / 60);
    const mm   = m % 60;
    const dur  = hh > 0 ? (mm > 0 ? `${hh}h ${mm}m` : `${hh}h`) : `${mm}m`;
    slots.push({
      key:      `${m}`,
      label:    fmtClock(end),
      sublabel: `${dur}  ·  Rs ${fee + svc}`,
      mins:     m,
      cost:     fee + svc,
    });
  }
  return slots;
}

// ── Circular ring timer (EasyPark style) ──────────────────────────────────────
const RING_SIZE  = 180;
const RING_R     = 76;
const RING_SW    = 10;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

function CircularTimer({
  elapsed, capMs, color, cost, rate,
}: {
  elapsed: number; capMs: number | null; color: string; cost: number; rate: number;
}) {
  // Progress: if cap set, show fraction of cap elapsed; else slow 60-min cycle
  const cycleMins = 60;
  const cycleMs   = cycleMins * 60000;
  const progress  = capMs !== null
    ? Math.min(1, elapsed / (elapsed + Math.max(0, capMs)))
    : (elapsed % cycleMs) / cycleMs;

  const offset = CIRCUMFERENCE * (1 - progress);

  return (
    <View style={circStyles.wrap}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        {/* Track */}
        <Circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
          stroke={Colors.borderLight} strokeWidth={RING_SW} fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
          stroke={color} strokeWidth={RING_SW} fill="none"
          strokeDasharray={`${CIRCUMFERENCE}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>
      {/* Center content */}
      <View style={circStyles.center}>
        <Text style={[circStyles.time, { color }]}>{fmtElapsed(elapsed)}</Text>
        <Text style={circStyles.costValue}>Rs {cost}</Text>
        <Text style={circStyles.rateLabel}>@ Rs {rate}/hr</Text>
      </View>
    </View>
  );
}

const circStyles = StyleSheet.create({
  wrap: {
    alignSelf: 'center', alignItems: 'center',
    justifyContent: 'center', marginBottom: 10,
  },
  center: {
    position: 'absolute', alignItems: 'center',
  },
  time:      { fontSize: 28, fontWeight: '800', letterSpacing: 1 },
  costValue: { fontSize: 18, fontWeight: '800', color: Colors.text, marginTop: 2 },
  rateLabel: { fontSize: 10, color: Colors.muted, marginTop: 1 },
});

// ── vehicle options ───────────────────────────────────────────────────────────
const VEHICLE_OPTIONS = [
  { value: '2w'  as const, label: 'Bike / Scooter',      icon: 'motorbike',       rateKey: 'rate2w'  },
  { value: '4w'  as const, label: 'Car / Jeep',          icon: 'car',             rateKey: 'rate4w'  },
  { value: 'ev'  as const, label: 'Electric Vehicle',    icon: 'lightning-bolt',  rateKey: 'rateEv'  },
  { value: 'bus' as const, label: 'Bus / Minibus',        icon: 'bus',             rateKey: 'rateBus' },
];

// ── component ─────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets   = useSafeAreaInsets();
  const { user, activeSession, setActiveSession, extendSession } = useStore();
  const mapRef   = useRef<MapView>(null);

  // map / zone
  const [location,      setLocation]      = useState({ lat: 27.7048, lng: 85.3132 });
  const [zoneInput,     setZoneInput]      = useState('');
  const [selectedZone,  setSelectedZone]  = useState(mockZones[0]);
  const [vehicleType,   setVehicleType]    = useState<'2w' | '4w' | 'ev' | 'bus'>(user?.vehicleType ?? '2w');
  const [step,          setStep]           = useState<'search' | 'confirm'>('search');

  // time picker — null = open-ended
  const [selectedMins, setSelectedMins] = useState<number | null>(null);

  // payment
  const [payMethod,  setPayMethod]  = useState<PMId>('esewa');
  const [starting,   setStarting]   = useState(false);

  // stop modal
  const [stopModal,  setStopModal]  = useState(false);
  const [stopping,   setStopping]   = useState(false);

  // live clock for elapsed timer & cost
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        mapRef.current?.animateToRegion({
          latitude: pos.coords.latitude, longitude: pos.coords.longitude,
          latitudeDelta: 0.02, longitudeDelta: 0.02,
        });
      } catch { /* default Kathmandu */ }
    })();
  }, []);

  const rate = vehicleType === 'bus' ? selectedZone.rateBus
    : vehicleType === 'ev'  ? selectedZone.rateEv
    : vehicleType === '4w'  ? selectedZone.rate4w
    : selectedZone.rate2w;

  const handleZoneSearch = useCallback((text: string) => {
    setZoneInput(text);
    const match = mockZones.find(z =>
      z.code.toLowerCase().includes(text.toLowerCase()) ||
      z.name.toLowerCase().includes(text.toLowerCase()),
    );
    if (match) setSelectedZone(match);
  }, []);

  const selectZone = useCallback((zone: typeof mockZones[0]) => {
    setSelectedZone(zone);
    setZoneInput(zone.code);
    mapRef.current?.animateToRegion({
      latitude: zone.latitude, longitude: zone.longitude,
      latitudeDelta: 0.012, longitudeDelta: 0.012,
    });
    setStep('confirm');
  }, []);

  const handleStart = async () => {
    if (selectedZone.occupancyPercent >= 95) {
      Alert.alert('Zone Full', 'No spots available. Try another zone.');
      return;
    }
    setStarting(true);
    const startTime = new Date();
    const isFree    = selectedZone.type === 'free';
    // For free zones: use freeTimeLimitMins as cap if no manual selection
    const capMins   = isFree
      ? (selectedMins ?? selectedZone.freeTimeLimitMins ?? null)
      : selectedMins;
    const endCap    = capMins ? new Date(startTime.getTime() + capMins * 60000) : null;

    try {
      await sessionsAPI.start({
        zoneCode: selectedZone.code,
        vehicleType,
        durationMinutes: capMins ?? 0,
        paymentMethod: isFree ? 'free' : payMethod,
      });
    } catch { /* dev fallback */ }

    setActiveSession({
      sessionId:       `dev_${Date.now()}`,
      zoneCode:        selectedZone.code,
      zoneName:        selectedZone.name,
      zoneLocation:    `${selectedZone.city}, Nepal`,
      startTime,
      endTimeCap:      endCap,
      vehicleType,
      hourlyRate:      isFree ? 0 : rate,
      paymentMethod:   isFree ? 'free' : payMethod,
      qrToken:         `QR-${selectedZone.code}-${Date.now()}`,
      expiresAt:       endCap ?? new Date(startTime.getTime() + 24 * 3600000),
      durationMinutes: capMins ?? 0,
      fee: 0, serviceFee: 0, totalPaid: 0,
    });

    // Send free parking notification
    if (isFree) {
      await sendFreeParkingNotification(selectedZone.name, selectedZone.freeTimeLimitMins);
    }

    setZoneInput('');
    setStep('search');
    setSelectedMins(null);
    setStarting(false);
  };

  const handleStop = async () => {
    if (!activeSession) return;
    setStopping(true);
    try { await sessionsAPI.stop(activeSession.sessionId); } catch { }
    setActiveSession(null);
    setStopModal(false);
    setStopping(false);
  };

  // ── live session maths ────────────────────────────────────────────────────
  const elapsed   = activeSession ? now - activeSession.startTime.getTime() : 0;
  const liveEnd   = new Date(now);
  const liveCost  = activeSession
    ? calcCost(activeSession.startTime, liveEnd, activeSession.hourlyRate)
    : null;

  const capMs      = activeSession?.endTimeCap
    ? activeSession.endTimeCap.getTime() - now
    : null;
  const nearingCap = capMs !== null && capMs > 0 && capMs < 10 * 60000;
  const pastCap    = capMs !== null && capMs <= 0;
  const timerColor = pastCap ? Colors.red : nearingCap ? Colors.orange : Colors.green;

  // ── render ────────────────────────────────────────────────────────────────
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
        {mockZones.map(z => {
          const cfg = ZONE_CONFIG[z.type];
          const pinBg = z.occupancyPercent >= 95 ? Colors.red : cfg.color;
          return (
            <Marker
              key={z.code}
              coordinate={{ latitude: z.latitude, longitude: z.longitude }}
              onPress={() => selectZone(z)}
            >
              <View style={[
                styles.zonePin,
                { backgroundColor: pinBg },
                selectedZone.code === z.code && styles.zonePinSelected,
              ]}>
                <Icon name={cfg.icon as any} size={14} color={Colors.white} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Floating top bar — EasyPark style */}
      <View style={[styles.topBar, { marginTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.mapFab}>
          <Icon name="magnify" size={22} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.mapFab}>
          <Icon name="menu" size={22} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* EV filter fab */}
      <View style={[styles.evFabWrap, { top: insets.top + 64 }]}>
        <TouchableOpacity style={styles.evFab}>
          <Icon name="lightning-bolt" size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Locate me */}
      <TouchableOpacity
        style={[styles.locateBtn, { bottom: 300 }]}
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

          {/* Zone + live badge */}
          <View style={styles.sessionTopRow}>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <Text style={styles.sessionZoneName} numberOfLines={1}>
              {activeSession.zoneName}
            </Text>
            <View style={styles.zoneCodePill}>
              <Text style={styles.zoneCodeText}>{activeSession.zoneCode}</Text>
            </View>
          </View>

          {/* ── Circular ring timer ── */}
          <CircularTimer
            elapsed={elapsed}
            capMs={capMs}
            color={timerColor}
            cost={liveCost?.total ?? 0}
            rate={activeSession.hourlyRate}
          />

          {/* Cap warning */}
          {nearingCap && (
            <View style={[styles.alertBanner, { backgroundColor: Colors.orangeLight }]}>
              <Icon name="clock-alert-outline" size={14} color={Colors.orange} />
              <Text style={[styles.alertText, { color: Colors.orange }]}>
                Approaching your set end time
              </Text>
            </View>
          )}
          {pastCap && (
            <View style={[styles.alertBanner, { backgroundColor: Colors.redLight }]}>
              <Icon name="alert-circle-outline" size={14} color={Colors.red} />
              <Text style={[styles.alertText, { color: Colors.red }]}>
                Past your planned end time — please stop now
              </Text>
            </View>
          )}

          {/* End time cap label */}
          {activeSession.endTimeCap && !pastCap && (
            <Text style={styles.capLabel}>
              Planned until {fmtClock(activeSession.endTimeCap)}
            </Text>
          )}

          {/* Actions */}
          <View style={styles.sessionActions}>
            <TouchableOpacity
              style={styles.extendBtn}
              onPress={() => extendSession(30)}
            >
              <Icon name="clock-plus-outline" size={16} color={Colors.primary} />
              <Text style={styles.extendBtnText}>+30m</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.extendBtn}
              onPress={() => extendSession(60)}
            >
              <Icon name="clock-plus-outline" size={16} color={Colors.primary} />
              <Text style={styles.extendBtnText}>+1h</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.stopBtn}
              onPress={() => setStopModal(true)}
            >
              <Icon name="stop-circle" size={18} color={Colors.white} />
              <Text style={styles.stopBtnText}>Stop & Pay</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* ── START PARKING ── */
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}
        >
          <View style={styles.sheetHandle} />

          {step === 'search' ? (
            <>
              {/* EasyPark-style "Select area" header */}
              <View style={styles.selectAreaHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>Select area</Text>
                  <Text style={styles.gpsNote}>Your GPS position might be uncertain</Text>
                </View>
                <TouchableOpacity style={styles.infoBtn}>
                  <Icon name="information-outline" size={20} color={Colors.muted} />
                </TouchableOpacity>
              </View>

              {/* Zone list — EasyPark card style */}
              <ScrollView showsVerticalScrollIndicator={false} style={styles.zoneList}>
                {mockZones
                  .filter(z => !zoneInput || z.name.toLowerCase().includes(zoneInput.toLowerCase()) || z.code.toLowerCase().includes(zoneInput.toLowerCase()))
                  .map((z, idx, arr) => {
                    const isEV  = z.type === 'electric';
                    const isFull = z.occupancyPercent >= 95;
                    const zoneNum = z.code.replace('Z-', '').replace(/-/g, ' ');
                    return (
                      <TouchableOpacity
                        key={z.code}
                        style={[styles.zoneListItem, idx === arr.length - 1 && { borderBottomWidth: 0 }]}
                        onPress={() => selectZone(z)}
                        activeOpacity={0.7}
                      >
                        {/* P badge or EV badge */}
                        <View style={[styles.zonePBadge, isEV && styles.zonePBadgeEV]}>
                          <Icon
                            name={isEV ? 'lightning-bolt' : 'alpha-p-box'}
                            size={isEV ? 14 : 16}
                            color={Colors.white}
                          />
                          <Text style={styles.zonePNum}>
                            {isEV ? '' : z.availableSpots}
                          </Text>
                        </View>

                        {/* Zone info */}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.zoneListName} numberOfLines={1}>{z.name}</Text>
                          <Text style={styles.zoneListSub}>
                            {z.type === 'free' ? 'Free' : z.type === 'electric' ? 'Charging station' : 'Surface Lot'}
                            {' • '}
                            {z.type === 'private' ? z.privateOperator : 'NSP'}
                          </Text>
                        </View>

                        {/* Availability / info */}
                        <TouchableOpacity style={styles.zoneInfoBtn}>
                          {isFull
                            ? <Text style={styles.zoneFullTag}>Full</Text>
                            : <Icon name="information-outline" size={18} color={Colors.muted} />
                          }
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            </>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.confirmScroll}
            >
              {/* Zone header */}
              <View style={styles.confirmHeader}>
                <TouchableOpacity onPress={() => setStep('search')} style={styles.backChip}>
                  <Icon name="arrow-left" size={14} color={Colors.primary} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <View style={styles.confirmNameRow}>
                    <Text style={styles.confirmZoneName}>{selectedZone.name}</Text>
                    <View style={[styles.zoneTypeBadge, { backgroundColor: ZONE_CONFIG[selectedZone.type].badgeBg }]}>
                      <Icon name={ZONE_CONFIG[selectedZone.type].icon as any} size={10} color={ZONE_CONFIG[selectedZone.type].badgeText} />
                      <Text style={[styles.zoneTypeBadgeText, { color: ZONE_CONFIG[selectedZone.type].badgeText }]}>
                        {ZONE_CONFIG[selectedZone.type].label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.confirmZoneCode}>{selectedZone.code} · {selectedZone.city}</Text>
                </View>
                <View style={[styles.occupancyPill, {
                  backgroundColor: selectedZone.occupancyPercent >= 95
                    ? Colors.redLight : selectedZone.occupancyPercent >= 70
                    ? Colors.orangeLight : Colors.greenLight,
                }]}>
                  <Text style={[styles.occupancyText, {
                    color: selectedZone.occupancyPercent >= 95
                      ? Colors.red : selectedZone.occupancyPercent >= 70
                      ? Colors.orange : Colors.green,
                  }]}>
                    {selectedZone.occupancyPercent >= 95 ? 'Full'
                      : `${selectedZone.availableSpots} free`}
                  </Text>
                </View>
              </View>

              {/* Zone-type info banners */}
              {selectedZone.type === 'free' && (
                <View style={styles.infoBanner}>
                  <Icon name="alpha-b-box" size={16} color="#0055AA" />
                  <Text style={[styles.infoBannerText, { color: '#0055AA' }]}>
                    BLA Zone — Free parking
                    {selectedZone.freeTimeLimitMins
                      ? ` (max ${selectedZone.freeTimeLimitMins < 60 ? `${selectedZone.freeTimeLimitMins} min` : `${selectedZone.freeTimeLimitMins / 60}h`})`
                      : ''}
                  </Text>
                </View>
              )}
              {selectedZone.type === 'electric' && (
                <View style={[styles.infoBanner, { backgroundColor: Colors.greenLight }]}>
                  <Icon name="lightning-bolt" size={16} color={Colors.green} />
                  <Text style={[styles.infoBannerText, { color: Colors.green }]}>
                    EV Charging Zone · {selectedZone.evChargerCount} chargers available
                  </Text>
                </View>
              )}
              {selectedZone.type === 'private' && (
                <View style={[styles.infoBanner, { backgroundColor: '#EBEBEB' }]}>
                  <Icon name="shield-lock" size={16} color="#555" />
                  <Text style={[styles.infoBannerText, { color: '#555' }]}>
                    Private Parking · {selectedZone.privateOperator}
                  </Text>
                </View>
              )}

              {/* Vehicle selector — 4 types */}
              <View style={styles.vehicleGrid}>
                {VEHICLE_OPTIONS.map(vt => (
                  <TouchableOpacity
                    key={vt.value}
                    style={[styles.vehicleBtn, vehicleType === vt.value && styles.vehicleBtnActive]}
                    onPress={() => setVehicleType(vt.value)}
                  >
                    <Icon
                      name={vt.icon as any}
                      size={20}
                      color={vehicleType === vt.value ? Colors.white : Colors.muted}
                    />
                    <Text style={[styles.vehicleBtnLabel, vehicleType === vt.value && { color: Colors.white }]}>
                      {vt.label}
                    </Text>
                    <Text style={[styles.vehicleBtnRate, vehicleType === vt.value && { color: 'rgba(255,255,255,0.8)' }]}>
                      Rs {vt.rateKey === 'rateEv' ? selectedZone.rateEv
                        : vt.rateKey === 'rateBus' ? selectedZone.rateBus
                        : vt.rateKey === 'rate4w'  ? selectedZone.rate4w
                        : selectedZone.rate2w}/hr
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── Circular clock time picker ── */}
              <Text style={styles.pickerLabel}>Park until</Text>
              <ClockTimePicker
                selectedMins={selectedMins}
                onSelect={setSelectedMins}
                hourlyRate={rate}
                maxMins={selectedZone.type === 'free' ? (selectedZone.freeTimeLimitMins ?? 120) : undefined}
              />

              {/* Payment method — hidden for free zones */}
              {selectedZone.type !== 'free' && (
                <View style={styles.paymentRow}>
                  {PAYMENT_METHODS.map(m => (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.paymentChip,
                        payMethod === m.id && { borderColor: m.color, backgroundColor: m.color + '15' },
                      ]}
                      onPress={() => setPayMethod(m.id)}
                    >
                      <Text style={[styles.paymentChipText, payMethod === m.id && { color: m.color, fontWeight: '700' }]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Start button */}
              <TouchableOpacity
                style={[styles.startBtn, (starting || selectedZone.occupancyPercent >= 95) && styles.startBtnDisabled]}
                onPress={handleStart}
                disabled={starting || selectedZone.occupancyPercent >= 95}
              >
                {starting ? <ActivityIndicator color={Colors.white} /> : (
                  <View style={styles.startBtnInner}>
                    <View>
                      <Text style={styles.startBtnLabel}>
                        {selectedZone.type === 'free' ? 'Start Free Parking' : 'Start Parking'}
                      </Text>
                      <Text style={styles.startBtnSub}>
                        {selectedZone.type === 'free'
                          ? `BLA Zone · No charge${selectedZone.freeTimeLimitMins ? ` · max ${selectedZone.freeTimeLimitMins < 60 ? `${selectedZone.freeTimeLimitMins}m` : `${selectedZone.freeTimeLimitMins / 60}h`}` : ''}`
                          : selectedMins
                            ? `Until ${fmtClock(new Date(Date.now() + selectedMins * 60000))}  ·  est. Rs ${Math.round(rate * selectedMins / 60 * 1.1)}`
                            : 'Open-ended · pay for time used'}
                      </Text>
                    </View>
                    <View style={styles.startArrow}>
                      <Icon name="arrow-right" size={20} color={Colors.primary} />
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      )}

      {/* ═══════════ STOP & PAY MODAL ═══════════ */}
      <Modal visible={stopModal} transparent animationType="slide" onRequestClose={() => setStopModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Stop Parking</Text>

            {activeSession && liveCost && (
              <>
                {/* Summary */}
                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Zone</Text>
                    <Text style={styles.summaryValue}>{activeSession.zoneName}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Duration</Text>
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
                  <View style={[styles.summaryRow, styles.summaryTotal]}>
                    <Text style={styles.summaryTotalLabel}>Total</Text>
                    <Text style={styles.summaryTotalValue}>Rs {liveCost.total}</Text>
                  </View>
                </View>

                {/* Payment method */}
                <Text style={styles.pickerLabel}>Pay with</Text>
                <View style={styles.paymentRow}>
                  {PAYMENT_METHODS.map(m => (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.paymentChip,
                        payMethod === m.id && { borderColor: m.color, backgroundColor: m.color + '15' },
                      ]}
                      onPress={() => setPayMethod(m.id)}
                    >
                      <Text style={[styles.paymentChipText, payMethod === m.id && { color: m.color, fontWeight: '700' }]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Confirm */}
                <TouchableOpacity
                  style={[styles.startBtn, stopping && styles.startBtnDisabled]}
                  onPress={handleStop}
                  disabled={stopping}
                >
                  {stopping ? <ActivityIndicator color={Colors.white} /> : (
                    <View style={styles.startBtnInner}>
                      <View>
                        <Text style={styles.startBtnLabel}>Confirm Payment</Text>
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
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────
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

  // Select area header
  selectAreaHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  gpsNote:  { fontSize: 13, color: Colors.muted, marginTop: 2 },
  infoBtn:  { padding: 4, marginTop: 2 },

  // Zone list — EasyPark card style
  zoneList: { marginHorizontal: -Spacing.lg },
  zoneListItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: Spacing.lg, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  zonePBadge: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: Colors.zoneBadge,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  zonePBadgeEV: { backgroundColor: Colors.green },
  zonePNum:  { fontSize: 10, fontWeight: '800', color: Colors.white },
  zoneListName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  zoneListSub:  { fontSize: 12, color: Colors.muted, marginTop: 2 },
  zoneInfoBtn:  { padding: 4 },
  zoneFullTag:  { fontSize: 11, fontWeight: '700', color: Colors.red, backgroundColor: Colors.redLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },

  youDot:      { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,110,230,0.2)', alignItems: 'center', justifyContent: 'center' },
  youDotInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary, borderWidth: 2, borderColor: Colors.white },

  zonePin: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: Colors.white,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  zonePinSelected: { width: 38, height: 38, borderRadius: 19, borderColor: Colors.primary, borderWidth: 3 },
  zonePinText: { fontSize: 13, fontWeight: '900', color: Colors.white },

  locateBtn: {
    position: 'absolute', right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },

  // ── sheet ──
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    maxHeight: '85%',
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg, paddingTop: 8,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, elevation: 12,
  },
  confirmScroll: { paddingBottom: 8 },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 12,
  },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 2 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.lg, backgroundColor: Colors.light, marginBottom: 12,
  },
  searchInput: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 10,
    fontSize: 14, color: Colors.text,
  },
  zoneChipScroll: { marginBottom: 12 },
  zoneChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.light, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8,
  },
  zoneChipFull:  { opacity: 0.45 },
  zoneChipDot:   { width: 8, height: 8, borderRadius: 4 },
  zoneChipName:  { fontSize: 13, fontWeight: '600', color: Colors.text },
  zoneChipCode:  { fontSize: 11, color: Colors.muted },

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

  // ── EasyPark time picker ──
  pickerLabel: { fontSize: 12, fontWeight: '700', color: Colors.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  timePicker:  { marginBottom: 12 },
  timeSlot: {
    minWidth: 80, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.light, marginRight: 8, alignItems: 'center',
  },
  timeSlotActive:       { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timeSlotMain:         { fontSize: 14, fontWeight: '800', color: Colors.text },
  timeSlotMainActive:   { color: Colors.white },
  timeSlotSub:          { fontSize: 10, color: Colors.muted, marginTop: 3, textAlign: 'center' },
  timeSlotSubActive:    { color: 'rgba(255,255,255,0.75)' },

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

  // ── active session ──
  sessionTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.greenLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  liveDot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.green },
  liveText:       { fontSize: 11, fontWeight: '800', color: Colors.green, letterSpacing: 0.5 },
  sessionZoneName:{ flex: 1, fontSize: 14, fontWeight: '700', color: Colors.text },
  zoneCodePill: {
    backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  zoneCodeText:   { fontSize: 10, fontWeight: '700', color: Colors.primary },

  elapsedTimer: {
    fontSize: 48, fontWeight: '800', color: Colors.text,
    letterSpacing: 3, textAlign: 'center', marginBottom: 4,
  },
  liveCostRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center',
    gap: 6, marginBottom: 10,
  },
  liveCostLabel: { fontSize: 12, color: Colors.muted },
  liveCostValue: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  liveCostRate:  { fontSize: 11, color: Colors.muted },

  capLabel: { fontSize: 12, color: Colors.muted, textAlign: 'center', marginBottom: 8 },

  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: BorderRadius.sm, padding: 8, marginBottom: 10,
  },
  alertText: { fontSize: 12, flex: 1 },

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

  // ── stop modal ──
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
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 5,
  },
  summaryLabel:      { fontSize: 13, color: Colors.muted },
  summaryValue:      { fontSize: 13, fontWeight: '600', color: Colors.text },
  summaryTotal:      { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4, paddingTop: 10 },
  summaryTotalLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  summaryTotalValue: { fontSize: 20, fontWeight: '800', color: Colors.primary },

  cancelBtn:     { alignItems: 'center', paddingVertical: 14 },
  cancelBtnText: { fontSize: 14, color: Colors.muted, fontWeight: '600' },
});
