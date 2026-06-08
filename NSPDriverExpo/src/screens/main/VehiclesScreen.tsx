import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Modal, TextInput, StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors, Spacing, BorderRadius } from '@/utils/theme';
import { useStore, Vehicle, VehicleType } from '@/store/useStore';

const VEHICLE_ICONS: Record<VehicleType, string> = {
  '2w': 'motorbike',
  '4w': 'car',
  ev:   'lightning-bolt',
  bus:  'bus',
};
const VEHICLE_LABELS: Record<VehicleType, string> = {
  '2w': 'Bike / Scooter',
  '4w': 'Car / Jeep',
  ev:   'Electric Vehicle',
  bus:  'Bus / Minibus',
};
const VEHICLE_RATES: Record<VehicleType, number> = {
  '2w': 25, '4w': 50, ev: 35, bus: 75,
};

// ── Nepal plate widget ────────────────────────────────────────────────────────
function LicensePlate({ plate }: { plate: string }) {
  return (
    <View style={plateStyles.wrap}>
      <View style={plateStyles.blueBar} />
      <Text style={plateStyles.text}>{plate}</Text>
    </View>
  );
}
const plateStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'stretch',
    borderWidth: 1.5, borderColor: '#CCC',
    borderRadius: 6, overflow: 'hidden', backgroundColor: '#fff',
    alignSelf: 'flex-start',   // don't stretch to full width
    maxWidth: '100%',
  },
  blueBar: { width: 6, backgroundColor: '#1A56DB', flexShrink: 0 },
  text: {
    paddingHorizontal: 12, paddingVertical: 5,
    fontSize: 15, fontWeight: '800', color: Colors.text, letterSpacing: 1,
    flexShrink: 1,             // shrink if container is narrow
  },
});

// ── Vehicle type picker (used in Add modal) ───────────────────────────────────
const TYPES: { value: VehicleType; label: string; icon: string }[] = [
  { value: '2w',  label: 'Bike',     icon: 'motorbike'      },
  { value: '4w',  label: 'Car',      icon: 'car'            },
  { value: 'ev',  label: 'Electric', icon: 'lightning-bolt' },
  { value: 'bus', label: 'Bus',      icon: 'bus'            },
];

export default function VehiclesScreen() {
  const navigation = useNavigation();
  const { user, setUser } = useStore();
  const insets = useSafeAreaInsets();

  // Per-vehicle menu state
  const [menuPlate,    setMenuPlate]    = useState<string | null>(null);
  // Add vehicle modal
  const [addVisible,   setAddVisible]   = useState(false);
  const [newPlate,     setNewPlate]     = useState('');
  const [newType,      setNewType]      = useState<VehicleType>('4w');
  const [ownerConfirm, setOwnerConfirm] = useState(false);
  const [plateError,   setPlateError]   = useState('');

  if (!user) return null;

  const vehicles = user.vehicles ?? [];

  // ── Persist helpers ──────────────────────────────────────────────────────
  const persistUser = async (updatedVehicles: Vehicle[]) => {
    const updated = { ...user, vehicles: updatedVehicles };
    setUser(updated);
    await AsyncStorage.setItem('nsp_user', JSON.stringify(updated));
  };

  // ── Set primary ──────────────────────────────────────────────────────────
  const handleSetPrimary = async (plate: string) => {
    setMenuPlate(null);
    const updated = vehicles.map(v => ({ ...v, isPrimary: v.plateNumber === plate }));
    await persistUser(updated);
  };

  // ── Remove vehicle ───────────────────────────────────────────────────────
  const handleRemove = (plate: string) => {
    setMenuPlate(null);
    if (vehicles.length === 1) {
      Alert.alert('Cannot Remove', 'You must have at least one vehicle on your account.');
      return;
    }
    Alert.alert(
      'Remove Vehicle',
      `Remove ${plate} from your account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            let updated = vehicles.filter(v => v.plateNumber !== plate);
            // Reassign primary if needed
            if (!updated.some(v => v.isPrimary)) {
              updated = [{ ...updated[0], isPrimary: true }, ...updated.slice(1)];
            }
            await persistUser(updated);
          },
        },
      ],
    );
  };

  // ── Add vehicle ──────────────────────────────────────────────────────────
  const handleAdd = async () => {
    const plate = newPlate.trim().toUpperCase();
    if (plate.length < 4) {
      setPlateError('Enter a valid plate number (e.g. BA 1 KHA 1234).');
      return;
    }
    if (!ownerConfirm) {
      setPlateError('Please confirm this plate belongs to you.');
      return;
    }
    if (vehicles.some(v => v.plateNumber === plate)) {
      setPlateError('This plate is already on your account.');
      return;
    }
    const newVehicle: Vehicle = {
      id: `v_${Date.now()}`,
      plateNumber: plate,
      vehicleType: newType,
      isPrimary: false,
      plateVerified: false,
    };
    await persistUser([...vehicles, newVehicle]);
    setAddVisible(false);
    setNewPlate('');
    setOwnerConfirm(false);
    setPlateError('');
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Vehicles</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Info note */}
        <View style={styles.noteRow}>
          <Icon name="information-outline" size={15} color={Colors.primary} />
          <Text style={styles.noteText}>
            All vehicles are registered under your National ID{' '}
            <Text style={{ fontWeight: '700' }}>{user.nationalId}</Text>.
          </Text>
        </View>

        {/* Vehicle cards */}
        {vehicles.map(v => (
          <View key={v.plateNumber} style={styles.vehicleCard}>

            {/* ── Main row ── */}
            <View style={styles.vehicleRow}>
              {/* Vehicle type icon */}
              <View style={[styles.typeIconBox, v.isPrimary && styles.typeIconBoxPrimary]}>
                <Icon
                  name={VEHICLE_ICONS[v.vehicleType] as any}
                  size={22}
                  color={v.isPrimary ? Colors.white : Colors.primary}
                />
              </View>

              {/* Plate + labels — flex:1 + minWidth:0 keeps it from overflowing */}
              <View style={styles.vehicleInfo}>
                <LicensePlate plate={v.plateNumber} />
                <Text style={styles.vehicleSubLabel} numberOfLines={2}>
                  {VEHICLE_LABELS[v.vehicleType]}
                  {'  ·  '}Rs {VEHICLE_RATES[v.vehicleType]}/hr
                  {v.isPrimary
                    ? <Text style={styles.primaryTag}>{'  ·  PRIMARY'}</Text>
                    : null}
                </Text>
              </View>

              {/* Verified icon + 3-dot menu — fixed width, never pushed off */}
              <View style={styles.vehicleActions}>
                {v.plateVerified
                  ? <Icon name="check-circle" size={18} color={Colors.green} />
                  : <Icon name="alert-circle-outline" size={18} color={Colors.orange} />
                }
                <TouchableOpacity
                  style={styles.menuBtn}
                  onPress={() => setMenuPlate(v.plateNumber)}
                >
                  <Icon name="dots-vertical" size={20} color={Colors.muted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Unverified banner (below the row) ── */}
            {!v.plateVerified && (
              <View style={styles.unverifiedBanner}>
                <Icon name="shield-alert-outline" size={13} color={Colors.orange} />
                <Text style={styles.unverifiedText}>
                  Self-declared — may be verified by a parking officer
                </Text>
              </View>
            )}

            {/* ── Primary badge (below, only for primary) ── */}
            {v.isPrimary && (
              <View style={styles.primaryBadgeRow}>
                <Icon name="star" size={11} color={Colors.primary} />
                <Text style={styles.primaryBadgeText}>Primary vehicle</Text>
              </View>
            )}
          </View>
        ))}

        {/* Empty state */}
        {vehicles.length === 0 && (
          <View style={styles.empty}>
            <Icon name="car-off" size={44} color={Colors.border} />
            <Text style={styles.emptyText}>No vehicles added yet.</Text>
          </View>
        )}
      </ScrollView>

      {/* Add vehicle button — paddingBottom keeps it above the system nav bar */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddVisible(true)}>
          <Icon name="plus" size={20} color={Colors.white} />
          <Text style={styles.addBtnText}>Add Another Vehicle</Text>
        </TouchableOpacity>
      </View>

      {/* ── Per-vehicle action sheet ── */}
      <Modal visible={!!menuPlate} transparent animationType="fade" onRequestClose={() => setMenuPlate(null)}>
        <TouchableOpacity style={styles.overlay} onPress={() => setMenuPlate(null)} activeOpacity={1}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{menuPlate}</Text>
            {/* Set as primary (only if not already primary) */}
            {!vehicles.find(v => v.plateNumber === menuPlate)?.isPrimary && (
              <>
                <TouchableOpacity style={styles.sheetItem} onPress={() => handleSetPrimary(menuPlate!)}>
                  <Icon name="star-outline" size={18} color={Colors.primary} />
                  <Text style={[styles.sheetItemText, { color: Colors.primary }]}>Set as Primary Vehicle</Text>
                </TouchableOpacity>
                <View style={styles.sheetDivider} />
              </>
            )}
            <TouchableOpacity style={styles.sheetItem} onPress={() => handleRemove(menuPlate!)}>
              <Icon name="delete-outline" size={18} color={Colors.red} />
              <Text style={[styles.sheetItemText, { color: Colors.red }]}>Remove Vehicle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sheetItem, { borderTopWidth: 1, borderTopColor: Colors.border }]}
              onPress={() => setMenuPlate(null)}>
              <Text style={[styles.sheetItemText, { textAlign: 'center', flex: 1 }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Add vehicle modal ── */}
      <Modal visible={addVisible} transparent animationType="slide" onRequestClose={() => setAddVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.addSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.addTitle}>Add Vehicle</Text>

            {/* Type picker */}
            <Text style={styles.addLabel}>Vehicle Type</Text>
            <View style={styles.typeRow}>
              {TYPES.map(t => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeCard, newType === t.value && styles.typeCardActive]}
                  onPress={() => setNewType(t.value)}
                >
                  <Icon name={t.icon as any} size={20} color={newType === t.value ? Colors.white : Colors.muted} />
                  <Text style={[styles.typeCardLabel, newType === t.value && { color: Colors.white }]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Plate input */}
            <Text style={styles.addLabel}>Plate Number</Text>
            <View style={[styles.addInputWrap, plateError ? styles.addInputError : null]}>
              <Icon name="card-text-outline" size={18} color={Colors.muted} style={{ marginLeft: 12 }} />
              <TextInput
                style={styles.addInput}
                placeholder="BA 1 KHA 1234"
                placeholderTextColor={Colors.muted}
                value={newPlate}
                onChangeText={t => { setNewPlate(t.toUpperCase()); setPlateError(''); }}
                autoCapitalize="characters"
              />
            </View>
            {plateError ? (
              <View style={styles.errRow}>
                <Icon name="alert-circle-outline" size={13} color={Colors.red} />
                <Text style={styles.errText}>{plateError}</Text>
              </View>
            ) : null}

            {/* Ownership confirmation */}
            <TouchableOpacity style={styles.checkRow} onPress={() => setOwnerConfirm(v => !v)} activeOpacity={0.7}>
              <View style={[styles.checkbox, ownerConfirm && styles.checkboxActive]}>
                {ownerConfirm && <Icon name="check" size={12} color={Colors.white} />}
              </View>
              <Text style={styles.checkText}>
                I confirm this plate <Text style={{ fontWeight: '700' }}>belongs to me</Text>
              </Text>
            </TouchableOpacity>

            {/* Buttons */}
            <View style={styles.addBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setAddVisible(false); setNewPlate(''); setPlateError(''); setOwnerConfirm(false); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (!newPlate.trim() || !ownerConfirm) && styles.saveBtnDisabled]}
                onPress={handleAdd}
                disabled={!newPlate.trim() || !ownerConfirm}
              >
                <Text style={styles.saveBtnText}>Add Vehicle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },

  body: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.xxl },

  noteRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.sm,
    padding: Spacing.sm + 2, marginBottom: Spacing.sm,
    flexShrink: 1,
  },
  noteText: { fontSize: 12, color: Colors.primary, flex: 1, lineHeight: 17, flexWrap: 'wrap' },

  // Vehicle card — column layout to avoid overflow
  vehicleCard: {
    backgroundColor: Colors.light, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'column', gap: 8,
  },
  // The single horizontal row inside the card
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  typeIconBox: {
    width: 44, height: 44, borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,   // never shrink the icon
  },
  typeIconBoxPrimary: { backgroundColor: Colors.primary },
  // Middle section — flex:1 + minWidth:0 prevents text from pushing right side off screen
  vehicleInfo: {
    flex: 1,
    minWidth: 0,
  },
  vehicleSubLabel: {
    fontSize: 11, color: Colors.muted, marginTop: 4,
    flexWrap: 'wrap',
  },
  primaryTag: { color: Colors.primary, fontWeight: '700' },
  // Right-side actions — fixed, never compressed
  vehicleActions: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    flexShrink: 0,
  },
  menuBtn: { padding: 4 },

  // Unverified banner — full-width row below the main row
  unverifiedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.orangeLight, borderRadius: BorderRadius.sm,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  unverifiedText: { fontSize: 11, color: Colors.orange, fontWeight: '600', flex: 1 },

  // Primary badge row
  primaryBadgeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.sm,
    paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start',
  },
  primaryBadgeText: { fontSize: 11, color: Colors.primary, fontWeight: '700' },

  empty: { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xxl },
  emptyText: { fontSize: 14, color: Colors.muted },

  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.white,
  },
  addBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  addBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },

  // Action sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: 32,
  },
  sheetTitle:    { fontSize: 13, fontWeight: '700', color: Colors.muted, paddingVertical: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  sheetItem:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  sheetItemText: { fontSize: 15, color: Colors.text, fontWeight: '500' },
  sheetDivider:  { height: 1, backgroundColor: Colors.border },

  // Add vehicle sheet
  addSheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.lg, paddingBottom: 40,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16,
  },
  addTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  addLabel: { fontSize: 13, fontWeight: '600', color: Colors.muted, marginBottom: 6, marginTop: Spacing.sm },

  typeRow:      { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  typeCard: {
    flex: 1, alignItems: 'center', paddingVertical: 10, gap: 4,
    borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  typeCardActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeCardLabel:  { fontSize: 10, fontWeight: '700', color: Colors.muted, textAlign: 'center' },

  addInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, backgroundColor: Colors.light, marginBottom: 4,
  },
  addInputError: { borderColor: Colors.red },
  addInput: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 10,
    fontSize: 15, fontWeight: '700', color: Colors.text, letterSpacing: 1,
  },

  errRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  errText: { fontSize: 12, color: Colors.red, flex: 1 },

  checkRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFF8E1', borderRadius: BorderRadius.sm,
    padding: Spacing.sm + 2, marginVertical: Spacing.sm,
    borderWidth: 1, borderColor: '#FFE082',
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 2, borderColor: Colors.muted,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  checkboxActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  checkText: { fontSize: 12, color: Colors.text, flex: 1, lineHeight: 17 },

  addBtnRow:   { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: Colors.muted },
  saveBtn: {
    flex: 2, paddingVertical: 12, borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: Colors.muted },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
