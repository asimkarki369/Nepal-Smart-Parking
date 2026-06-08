import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Modal, TextInput, StatusBar, KeyboardAvoidingView, Platform,
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
  '2w': 25, '4w': 50, ev: 15, bus: 75,
};

// ── Nepal plate widget ────────────────────────────────────────────────────────
function LicensePlate({ plate, active }: { plate: string; active?: boolean }) {
  return (
    <View style={[plateStyles.wrap, active && plateStyles.wrapActive]}>
      <View style={[plateStyles.blueBar, active && plateStyles.blueBarActive]} />
      <Text style={plateStyles.text}>{plate}</Text>
    </View>
  );
}
const plateStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'stretch',
    borderWidth: 1.5, borderColor: '#CCC',
    borderRadius: 6, overflow: 'hidden', backgroundColor: '#fff',
    alignSelf: 'flex-start', maxWidth: '100%',
  },
  wrapActive: { borderColor: Colors.primary },
  blueBar:       { width: 6, backgroundColor: '#1A56DB', flexShrink: 0 },
  blueBarActive: { backgroundColor: Colors.primary },
  text: {
    paddingHorizontal: 12, paddingVertical: 5,
    fontSize: 15, fontWeight: '800', color: Colors.text, letterSpacing: 1,
    flexShrink: 1,
  },
});

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

  // Per-vehicle delete menu
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

  // ── Select vehicle for parking (instant, no dialog) ──────────────────────
  const handleSelect = async (plate: string) => {
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

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Info note */}
        <View style={styles.noteRow}>
          <Icon name="information-outline" size={15} color={Colors.primary} />
          <Text style={styles.noteText}>
            All vehicles are registered under your National ID{' '}
            <Text style={{ fontWeight: '700' }}>{user.nationalId}</Text>.
          </Text>
        </View>

        {/* Hint */}
        <Text style={styles.hintText}>Tap a vehicle to select it for parking</Text>

        {/* Vehicle cards */}
        {vehicles.map(v => {
          const isSelected = v.isPrimary;
          return (
            <TouchableOpacity
              key={v.plateNumber}
              style={[styles.vehicleCard, isSelected && styles.vehicleCardSelected]}
              onPress={() => handleSelect(v.plateNumber)}
              activeOpacity={0.75}
            >
              {/* Selected checkmark badge (top-right) */}
              {isSelected && (
                <View style={styles.checkBadge}>
                  <Icon name="check-bold" size={11} color={Colors.white} />
                </View>
              )}

              {/* ── Main row ── */}
              <View style={styles.vehicleRow}>
                {/* Vehicle type icon */}
                <View style={[styles.typeIconBox, isSelected && styles.typeIconBoxSelected]}>
                  <Icon
                    name={VEHICLE_ICONS[v.vehicleType] as any}
                    size={22}
                    color={isSelected ? Colors.white : Colors.primary}
                  />
                </View>

                {/* Plate + labels */}
                <View style={styles.vehicleInfo}>
                  <LicensePlate plate={v.plateNumber} active={isSelected} />
                  <Text style={styles.vehicleSubLabel} numberOfLines={2}>
                    {VEHICLE_LABELS[v.vehicleType]}{'  ·  '}Rs {VEHICLE_RATES[v.vehicleType]}/hr
                  </Text>
                </View>

                {/* 3-dot menu (delete only) */}
                <TouchableOpacity
                  style={styles.menuBtn}
                  onPress={() => setMenuPlate(v.plateNumber)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon name="dots-vertical" size={20} color={Colors.muted} />
                </TouchableOpacity>
              </View>

              {/* Status rows */}
              {!v.plateVerified && (
                <View style={styles.unverifiedBanner}>
                  <Icon name="shield-alert-outline" size={13} color={Colors.orange} />
                  <Text style={styles.unverifiedText}>
                    Self-declared — may be verified by a parking officer
                  </Text>
                </View>
              )}

              {isSelected ? (
                <View style={styles.selectedBanner}>
                  <Icon name="parking" size={13} color={Colors.primary} />
                  <Text style={styles.selectedBannerText}>Selected for parking</Text>
                </View>
              ) : (
                <View style={styles.tapHintRow}>
                  <Icon name="gesture-tap" size={13} color={Colors.muted} />
                  <Text style={styles.tapHintText}>Tap to park with this vehicle</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {vehicles.length === 0 && (
          <View style={styles.empty}>
            <Icon name="car-off" size={44} color={Colors.border} />
            <Text style={styles.emptyText}>No vehicles added yet.</Text>
          </View>
        )}
      </ScrollView>

      {/* Add vehicle button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddVisible(true)}>
          <Icon name="plus" size={20} color={Colors.white} />
          <Text style={styles.addBtnText}>Add Another Vehicle</Text>
        </TouchableOpacity>
      </View>

      {/* ── Delete-only action sheet ── */}
      <Modal visible={!!menuPlate} transparent animationType="fade" onRequestClose={() => setMenuPlate(null)}>
        <TouchableOpacity style={styles.overlay} onPress={() => setMenuPlate(null)} activeOpacity={1}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{menuPlate}</Text>
            <TouchableOpacity style={styles.sheetItem} onPress={() => handleRemove(menuPlate!)}>
              <Icon name="delete-outline" size={18} color={Colors.red} />
              <Text style={[styles.sheetItemText, { color: Colors.red }]}>Remove Vehicle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetItem, { borderTopWidth: 1, borderTopColor: Colors.border }]}
              onPress={() => setMenuPlate(null)}
            >
              <Text style={[styles.sheetItemText, { textAlign: 'center', flex: 1 }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Add vehicle modal ── */}
      <Modal visible={addVisible} transparent animationType="slide" onRequestClose={() => setAddVisible(false)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setAddVisible(false)} />
          <View style={styles.addSheet}>
            <View style={styles.sheetHandle} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.md }}
            >
              <Text style={styles.addTitle}>Add Vehicle</Text>

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
                  returnKeyType="done"
                />
              </View>
              {plateError ? (
                <View style={styles.errRow}>
                  <Icon name="alert-circle-outline" size={13} color={Colors.red} />
                  <Text style={styles.errText}>{plateError}</Text>
                </View>
              ) : null}

              <TouchableOpacity style={styles.checkRow} onPress={() => setOwnerConfirm(v => !v)} activeOpacity={0.7}>
                <View style={[styles.checkbox, ownerConfirm && styles.checkboxActive]}>
                  {ownerConfirm && <Icon name="check" size={12} color={Colors.white} />}
                </View>
                <Text style={styles.checkText}>
                  I confirm this plate <Text style={{ fontWeight: '700' }}>belongs to me</Text>
                </Text>
              </TouchableOpacity>

              <View style={styles.addBtnRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => { setAddVisible(false); setNewPlate(''); setPlateError(''); setOwnerConfirm(false); }}
                >
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
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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

  body: { padding: Spacing.lg, gap: Spacing.sm },

  noteRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.sm,
    padding: Spacing.sm + 2, marginBottom: 4,
  },
  noteText: { fontSize: 12, color: Colors.primary, flex: 1, lineHeight: 17 },

  hintText: {
    fontSize: 12, color: Colors.muted, textAlign: 'center',
    marginBottom: Spacing.sm, fontWeight: '500',
  },

  // Vehicle card
  vehicleCard: {
    backgroundColor: Colors.light, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 2, borderColor: Colors.border,
    gap: 8, position: 'relative',
  },
  vehicleCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },

  // Checkmark badge (top-right corner)
  checkBadge: {
    position: 'absolute', top: 10, right: 10,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },

  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },

  typeIconBox: {
    width: 44, height: 44, borderRadius: BorderRadius.md,
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  typeIconBoxSelected: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },

  vehicleInfo:    { flex: 1, minWidth: 0 },
  vehicleSubLabel:{ fontSize: 11, color: Colors.muted, marginTop: 4 },

  menuBtn: { padding: 6, flexShrink: 0 },

  // Unverified banner
  unverifiedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.orangeLight, borderRadius: BorderRadius.sm,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  unverifiedText: { fontSize: 11, color: Colors.orange, fontWeight: '600', flex: 1 },

  // Selected banner
  selectedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.white, borderRadius: BorderRadius.sm,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.primary,
    alignSelf: 'flex-start',
  },
  selectedBannerText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },

  // Tap hint (non-selected)
  tapHintRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 2,
  },
  tapHintText: { fontSize: 11, color: Colors.muted },

  empty: { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xxl },
  emptyText: { fontSize: 14, color: Colors.muted },

  footer: {
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.white,
  },
  addBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  addBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },

  // Action sheet (delete only)
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: 32,
  },
  sheetTitle:    { fontSize: 13, fontWeight: '700', color: Colors.muted, paddingVertical: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  sheetItem:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  sheetItemText: { fontSize: 15, color: Colors.text, fontWeight: '500' },

  // Add vehicle sheet
  addSheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16,
  },
  addTitle:  { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  addLabel:  { fontSize: 13, fontWeight: '600', color: Colors.muted, marginBottom: 6, marginTop: Spacing.sm },

  typeRow:       { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  typeCard: {
    flex: 1, alignItems: 'center', paddingVertical: 10, gap: 4,
    borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  typeCardActive:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeCardLabel:   { fontSize: 10, fontWeight: '700', color: Colors.muted, textAlign: 'center' },

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
  checkboxActive:  { borderColor: Colors.primary, backgroundColor: Colors.primary },
  checkText:       { fontSize: 12, color: Colors.text, flex: 1, lineHeight: 17 },

  addBtnRow:     { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
  },
  cancelBtnText:   { fontSize: 15, fontWeight: '600', color: Colors.muted },
  saveBtn: {
    flex: 2, paddingVertical: 12, borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: Colors.muted },
  saveBtnText:     { fontSize: 15, fontWeight: '700', color: Colors.white },
});
