/**
 * ZoneDetailScreen — EasyPark-style time-picker screen.
 *
 * Layout (top → bottom):
 *   ✕   [P  KMC-01]   ⓘ
 *   ── Vehicle type selector (4 chips) ──
 *   3 h 45 min                ← large duration counter
 *   ⏱ Ends 04:39              ← pill, updates live
 *   [ spinning ring clock ]
 *   Includes service fee Rs X
 *   [ Rs X · Continue ]
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Alert, ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing, BorderRadius } from '@/utils/theme';
import { mockZones, Zone } from '@/services/api';
import { useStore, userVehicleType, primaryVehicle } from '@/store/useStore';
import { RootStackParamList } from '@/navigation/types';
import ClockTimePicker from '@/components/ClockTimePicker';

type NavProp       = NativeStackNavigationProp<RootStackParamList>;
type RoutePropType = RouteProp<RootStackParamList, 'ZoneDetail'>;

// ── Vehicle options ───────────────────────────────────────────────────────────
type VType = '2w' | '4w' | 'ev' | 'bus';
const VEHICLE_OPTIONS: Array<{ value: VType; label: string; icon: string }> = [
  { value: '2w',  label: 'Bike/Scooter', icon: 'motorbike'       },
  { value: '4w',  label: 'Car/Jeep',    icon: 'car'             },
  { value: 'ev',  label: 'EV',          icon: 'lightning-bolt'  },
  { value: 'bus', label: 'Bus/Minibus', icon: 'bus'             },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const MAX_PARK_MINS = 3 * 24 * 60;  // 3 days = 4320 min

const DAY_CHIPS = [
  { label: '1 Day',   mins: 1440 },
  { label: '2 Days',  mins: 2880 },
  { label: '3 Days',  mins: 4320 },
];

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const d = Math.floor(mins / 1440);
  const rem = mins % 1440;
  const h = Math.floor(rem / 60);
  const m = rem % 60;
  if (d > 0) {
    const dayStr = `${d} ${d === 1 ? 'day' : 'days'}`;
    if (h === 0 && m === 0) return dayStr;
    if (m === 0) return `${dayStr} ${h} h`;
    return `${dayStr} ${h} h ${m} m`;
  }
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function fmtEndTime(mins: number): string {
  const end = new Date(Date.now() + mins * 60000);
  return end.toLocaleTimeString('en-NP', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function zoneRate(zone: Zone, vt: VType): number {
  if (vt === '2w')  return zone.rate2w;
  if (vt === 'ev')  return zone.rateEv  ?? zone.rate4w;
  if (vt === 'bus') return zone.rateBus ?? zone.rate4w;
  return zone.rate4w;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ZoneDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropType>();
  const insets     = useSafeAreaInsets();
  const { user }   = useStore();

  const zone    = mockZones.find(z => z.code === route.params.zoneCode) ?? mockZones[0];
  const isFree  = zone.type === 'free';
  const isEvZone = zone.type === 'electric';
  const maxMins = isFree ? (zone.freeTimeLimitMins ?? undefined) : undefined;
  const isFull  = zone.occupancyPercent >= 95;

  // Which vehicle types the user actually has plates registered for
  const userHasType = (vt: VType): boolean =>
    !!(user?.vehicles.some(v => v.vehicleType === vt));

  // A vehicle type chip is allowed to be selected when:
  //  • user has a plate of that type registered, AND
  //  • if this is an EV zone, only 'ev' is allowed
  const chipAllowed = (vt: VType): boolean => {
    if (isEvZone && vt !== 'ev') return false;   // EV zone: non-EV blocked
    return userHasType(vt);                       // must own that vehicle type
  };

  // Default to the primary vehicle's type, but if it's blocked (e.g. car in EV zone) fall back to ev
  const defaultVType = ((): VType => {
    const pv = userVehicleType(user) as VType;
    if (chipAllowed(pv)) return pv;
    if (isEvZone && userHasType('ev')) return 'ev';
    return pv;  // keep as-is; canContinue will block
  })();

  const [vehicleType,  setVehicleType]  = useState<VType>(defaultVType);
  const [selectedMins, setSelectedMins] = useState<number | null>(null);

  // Rate for currently selected vehicle type
  const rate = zoneRate(zone, vehicleType);

  // Cost breakdown
  const parkingFee = selectedMins && !isFree ? Math.round(rate * selectedMins / 60) : 0;
  const svcFee     = Math.round(parkingFee * 0.10);
  const totalFee   = parkingFee + svcFee;

  const canContinue = !isFull && selectedMins != null && chipAllowed(vehicleType);

  // Zone short code: "Z-KMC-01" → "KMC-01"
  const zoneShort = zone.code.replace(/^Z-/, '');

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Icon name="close" size={22} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.zoneBadgeRow}>
          <View style={styles.pBox}>
            <Text style={styles.pText}>P</Text>
          </View>
          <Text style={styles.zoneCodeText}>{zoneShort}</Text>
        </View>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() =>
            Alert.alert(
              zone.name,
              `Zone: ${zone.code}\nCity: ${zone.city}\nAvailable: ${zone.availableSpots} / ${zone.totalSpots}\nCar rate: Rs ${zone.rate4w}/hr\nBike rate: Rs ${zone.rate2w}/hr`,
            )
          }
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Icon name="information-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Vehicle type selector ── */}
        <View style={styles.vehicleSection}>
          <Text style={styles.sectionLabel}>Vehicle type</Text>

          {/* EV-zone restriction banner */}
          {isEvZone && (
            <View style={styles.evZoneBanner}>
              <Icon name="lightning-bolt" size={14} color={Colors.green} />
              <Text style={styles.evZoneBannerText}>
                EV charging zone — only registered electric vehicles may park here
              </Text>
            </View>
          )}

          <View style={styles.vehicleGrid}>
            {VEHICLE_OPTIONS.map(opt => {
              const r        = zoneRate(zone, opt.value);
              const allowed  = chipAllowed(opt.value);
              const active   = vehicleType === opt.value && allowed;
              const locked   = !allowed;

              // Reason for lock (shown as sub-label)
              const lockReason = isEvZone && opt.value !== 'ev'
                ? 'EV zone only'
                : !userHasType(opt.value)
                  ? 'Not registered'
                  : '';

              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.vehicleChip,
                    active  && styles.vehicleChipActive,
                    locked  && styles.vehicleChipLocked,
                  ]}
                  onPress={() => {
                    if (locked) {
                      const msg = isEvZone && opt.value !== 'ev'
                        ? 'This is an EV-only zone. Only electric vehicles may park here.'
                        : `You don't have a registered ${opt.label} plate. Go to My Vehicles to add one.`;
                      Alert.alert('Not Allowed', msg);
                      return;
                    }
                    setVehicleType(opt.value);
                  }}
                  activeOpacity={locked ? 1 : 0.75}
                >
                  {locked && (
                    <Icon name="lock" size={12} color={Colors.muted}
                      style={{ position: 'absolute', top: 6, right: 6 }} />
                  )}
                  <Icon
                    name={opt.icon as any}
                    size={20}
                    color={active ? Colors.white : locked ? Colors.border : Colors.muted}
                  />
                  <Text style={[
                    styles.vehicleChipLabel,
                    active && styles.vehicleChipLabelActive,
                    locked && styles.vehicleChipLabelLocked,
                  ]}>
                    {opt.label}
                  </Text>
                  <Text style={[
                    styles.vehicleChipRate,
                    active && styles.vehicleChipRateActive,
                    locked && styles.vehicleChipRateLocked,
                  ]}>
                    {locked ? lockReason : isFree ? 'Free' : `Rs ${r}/hr`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Duration display ── */}
        <View style={styles.durationBlock}>
          {selectedMins != null ? (
            <Text style={styles.durationText}>{fmtDuration(selectedMins)}</Text>
          ) : (
            <Text style={styles.durationPlaceholder}>-- min</Text>
          )}

          {/* Ends pill */}
          <View style={[styles.endsPill, selectedMins != null && styles.endsPillActive]}>
            <Icon
              name="timer-outline"
              size={15}
              color={selectedMins != null ? Colors.textSecondary : Colors.muted}
            />
            <Text style={[styles.endsText, selectedMins == null && { color: Colors.muted }]}>
              {selectedMins != null ? `Ends ${fmtEndTime(selectedMins)}` : 'Ends --:--'}
            </Text>
          </View>
        </View>

        {/* ── Spinning ring clock ── */}
        <View style={styles.clockWrap}>
          <ClockTimePicker
            selectedMins={selectedMins}
            onSelect={setSelectedMins}
            hourlyRate={rate}
            maxMins={isFree ? maxMins : MAX_PARK_MINS}
          />
        </View>

        {/* ── Day quick-select chips (1 Day / 2 Days / 3 Days) ── */}
        {!isFree && (
          <View style={styles.dayChipRow}>
            {DAY_CHIPS.map(c => {
              const active = selectedMins === c.mins;
              return (
                <TouchableOpacity
                  key={c.label}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                  onPress={() => setSelectedMins(active ? null : c.mins)}
                  activeOpacity={0.75}
                >
                  <Icon
                    name="calendar-outline"
                    size={14}
                    color={active ? Colors.white : Colors.muted}
                  />
                  <Text style={[styles.dayChipLabel, active && styles.dayChipLabelActive]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Fee note ── */}
        <View style={styles.feeRow}>
          {isFree ? (
            <Text style={styles.feeNote}>Free parking zone — no charge</Text>
          ) : selectedMins != null ? (
            <Text style={styles.feeNote}>Includes service fee Rs {svcFee}</Text>
          ) : (
            <Text style={styles.feeNote}>Spin the ring or pick a duration below</Text>
          )}
        </View>

        {/* ── Full zone warning ── */}
        {isFull && (
          <View style={styles.fullBanner}>
            <Icon name="alert-circle-outline" size={16} color={Colors.red} />
            <Text style={styles.fullBannerText}>This zone is currently full</Text>
          </View>
        )}

        {/* ── Continue button ── */}
        <TouchableOpacity
          style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
          disabled={!canContinue}
          onPress={() =>
            navigation.navigate('PaymentConfirm', {
              zoneCode:        zone.code,
              vehicleType:     vehicleType === 'ev' || vehicleType === 'bus' ? '4w' : vehicleType,
              durationMinutes: selectedMins!,
              hourlyRate:      rate,   // preserve EV/bus-specific rate
              // Find the plate matching the selected vehicle type; fall back to primary
              plateNumber: (
                user?.vehicles.find(v => v.vehicleType === vehicleType)
                ?? user?.vehicles.find(v => (vehicleType === 'ev' || vehicleType === 'bus') ? v.vehicleType === '4w' : v.vehicleType === vehicleType)
                ?? primaryVehicle(user ?? { vehicles: [] } as any)
              )?.plateNumber ?? '—',
            })
          }
          activeOpacity={0.85}
        >
          <Text style={[styles.continueBtnText, !canContinue && styles.continueBtnTextDisabled]}>
            {canContinue
              ? isFree ? 'Continue — Free' : `Rs ${totalFee} · Continue`
              : 'Continue'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingTop: Spacing.sm },

  // ── Top bar ──
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  zoneBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pBox: {
    width: 28, height: 28, borderRadius: 5,
    backgroundColor: Colors.zoneBadge,
    alignItems: 'center', justifyContent: 'center',
  },
  pText:        { fontSize: 14, fontWeight: '900', color: Colors.white },
  zoneCodeText: { fontSize: 18, fontWeight: '700', color: Colors.zoneBadge },

  // ── Vehicle selector ──
  vehicleSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },
  vehicleGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  vehicleChip: {
    // 2 × 2 grid: each chip takes ~48% of the row
    width: '48%', alignItems: 'center', gap: 4,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.light,
  },
  vehicleChipActive: {
    backgroundColor: Colors.primary,
    borderColor:     Colors.primary,
  },
  vehicleChipLocked: {
    backgroundColor: Colors.light,
    borderColor:     Colors.border,
    opacity: 0.6,
  },
  vehicleChipLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.muted,
  },
  vehicleChipLabelActive: { color: Colors.white },
  vehicleChipLabelLocked: { color: Colors.border },
  vehicleChipRate: {
    fontSize: 10, color: Colors.muted,
  },
  vehicleChipRateActive: { color: 'rgba(255,255,255,0.75)' },
  vehicleChipRateLocked: { color: Colors.border, fontSize: 9 },

  // EV zone banner
  evZoneBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: Colors.greenLight, borderRadius: BorderRadius.sm,
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.green,
  },
  evZoneBannerText: { fontSize: 12, color: Colors.green, fontWeight: '600', flex: 1 },

  // ── Duration block ──
  durationBlock: {
    alignItems: 'center',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm + 2,
  },
  durationText: {
    fontSize: 58, fontWeight: '800', color: Colors.text,
    letterSpacing: -2, lineHeight: 64,
  },
  durationPlaceholder: {
    fontSize: 58, fontWeight: '800', color: Colors.border,
    letterSpacing: -2, lineHeight: 64,
  },

  // Ends pill
  endsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: Colors.light, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg, paddingVertical: 9,
    borderWidth: 1, borderColor: Colors.border,
  },
  endsPillActive: { borderColor: 'transparent' },
  endsText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },

  // ── Clock ──
  clockWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },

  // ── Fee note ──
  feeRow: { alignItems: 'center', paddingVertical: Spacing.sm },
  feeNote: { fontSize: 13, color: Colors.muted, fontWeight: '500' },

  // ── Full banner ──
  fullBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.redLight, borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
  },
  fullBannerText: { fontSize: 13, color: Colors.red, fontWeight: '600', flex: 1 },

  // ── Day chips ──
  dayChipRow: {
    flexDirection: 'row', gap: 8, justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  dayChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.light,
  },
  dayChipActive: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },
  dayChipLabel: { fontSize: 13, fontWeight: '700', color: Colors.muted },
  dayChipLabelActive: { color: Colors.white },

  // ── Continue button ──
  continueBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 4,
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  continueBtnDisabled: { backgroundColor: Colors.border },
  continueBtnText:     { fontSize: 17, fontWeight: '700', color: Colors.white },
  continueBtnTextDisabled: { color: Colors.muted },
});
