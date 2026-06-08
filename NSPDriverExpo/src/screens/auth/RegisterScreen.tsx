import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  StatusBar, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors, Spacing, BorderRadius } from '@/utils/theme';
import { authAPI } from '@/services/api';
import { useStore, Vehicle, VehicleType } from '@/store/useStore';
import { RootStackParamList } from '@/navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

const VEHICLE_TYPES: { value: VehicleType; label: string; icon: string; rate: number }[] = [
  { value: '2w',  label: 'Bike / Scooter',   icon: 'motorbike',      rate: 25 },
  { value: '4w',  label: 'Car / Jeep',       icon: 'car',            rate: 50 },
  { value: 'ev',  label: 'Electric Vehicle', icon: 'lightning-bolt', rate: 35 },
  { value: 'bus', label: 'Bus / Minibus',    icon: 'bus',            rate: 75 },
];

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={styles.label}>
      {label}{required && <Text style={{ color: Colors.red }}> *</Text>}
    </Text>
  );
}
function ErrorMsg({ msg }: { msg: string }) {
  return (
    <View style={styles.errorRow}>
      <Icon name="alert-circle-outline" size={13} color={Colors.red} />
      <Text style={styles.errorText}>{msg}</Text>
    </View>
  );
}

// ── Nepal license plate mini-widget ──────────────────────────────────────────
function PlateBadge({ plate, type }: { plate: string; type: VehicleType }) {
  const typeIcon = VEHICLE_TYPES.find(v => v.value === type)?.icon ?? 'car';
  return (
    <View style={styles.plateBadge}>
      <Icon name={typeIcon as any} size={16} color={Colors.primary} />
      <View style={styles.plateBox}>
        <View style={styles.plateBlueBar} />
        <Text style={styles.plateText}>{plate}</Text>
      </View>
    </View>
  );
}

export default function RegisterScreen() {
  const navigation = useNavigation<NavProp>();
  const { setUser } = useStore();

  // ── Step state ────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — personal details
  const [fullName,   setFullName]   = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone,      setPhone]      = useState('');
  const [password,   setPassword]   = useState('');
  const [showPass,   setShowPass]   = useState(false);

  // Step 2 — vehicles
  const [vehicles,     setVehicles]     = useState<Omit<Vehicle, 'id'>[]>([]);
  const [newPlate,     setNewPlate]     = useState('');
  const [newType,      setNewType]      = useState<VehicleType>('4w');
  const [ownerConfirm, setOwnerConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});

  // ── Step 1 validation ─────────────────────────────────────────────────────
  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (fullName.trim().length < 3)   e.fullName   = 'Full name must be at least 3 characters.';
    if (nationalId.trim().length < 5) e.nationalId = 'Enter a valid National ID number.';
    if (password.length < 6)          e.password   = 'Password must be at least 6 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Add vehicle ───────────────────────────────────────────────────────────
  const addVehicle = () => {
    const plate = newPlate.trim().toUpperCase();
    if (plate.length < 4) {
      setErrors(e => ({ ...e, plate: 'Enter a valid plate number (e.g. BA 1 KHA 1234).' }));
      return;
    }
    if (!ownerConfirm) {
      setErrors(e => ({ ...e, plate: 'Please confirm this plate belongs to you.' }));
      return;
    }
    if (vehicles.some(v => v.plateNumber === plate)) {
      setErrors(e => ({ ...e, plate: 'This plate is already added.' }));
      return;
    }
    setVehicles(prev => [
      ...prev,
      { plateNumber: plate, vehicleType: newType, isPrimary: prev.length === 0, plateVerified: false },
    ]);
    setNewPlate('');
    setOwnerConfirm(false);
    setErrors(e => ({ ...e, plate: '' }));
  };

  const removeVehicle = (plate: string) => {
    setVehicles(prev => {
      const filtered = prev.filter(v => v.plateNumber !== plate);
      // Reassign primary to first if needed
      if (filtered.length > 0 && !filtered.some(v => v.isPrimary)) {
        filtered[0] = { ...filtered[0], isPrimary: true };
      }
      return filtered;
    });
  };

  const setPrimary = (plate: string) => {
    setVehicles(prev => prev.map(v => ({ ...v, isPrimary: v.plateNumber === plate })));
  };

  // ── Final submit ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (vehicles.length === 0) {
      Alert.alert('Add a Vehicle', 'Please add at least one vehicle to continue.');
      return;
    }
    setLoading(true);
    try {
      const res = await authAPI.register({
        fullName: fullName.trim(),
        nationalId: nationalId.trim(),
        phone: phone.trim() || undefined,
        password,
        vehicles,
      } as any);
      const { token, user } = res.data;
      await AsyncStorage.setItem('auth_token', token);
      setUser(user);
    } catch {
      // Dev fallback
      const devUser = {
        id:         `dev_${Date.now()}`,
        fullName:   fullName.trim(),
        nationalId: nationalId.trim(),
        phone:      phone.trim() || undefined,
        vehicles:   vehicles.map((v, i) => ({ ...v, id: `v_${i}` })),
        walletBalance: 0,
      };
      await AsyncStorage.setItem('auth_token', 'dev_token');
      await AsyncStorage.setItem('nsp_user', JSON.stringify(devUser));
      setUser(devUser);
    } finally {
      setLoading(false);
    }
  };

  // ── Progress indicator ─────────────────────────────────────────────────────
  const STEPS = ['Personal Details', 'Vehicles', 'Review'];

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => step === 1 ? navigation.goBack() : setStep(s => (s - 1) as any)}
        >
          <Icon name="arrow-left" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Account</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step progress */}
      <View style={styles.stepBar}>
        {STEPS.map((label, i) => (
          <View key={i} style={styles.stepItem}>
            <View style={[styles.stepDot, i + 1 <= step && styles.stepDotActive]}>
              {i + 1 < step
                ? <Icon name="check" size={12} color={Colors.white} />
                : <Text style={styles.stepDotText}>{i + 1}</Text>
              }
            </View>
            <Text style={[styles.stepLabel, i + 1 <= step && styles.stepLabelActive]}>{label}</Text>
            {i < STEPS.length - 1 && (
              <View style={[styles.stepLine, i + 1 < step && styles.stepLineActive]} />
            )}
          </View>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════ STEP 1 — Personal Details ══════════ */}
        {step === 1 && (
          <>
            <Text style={styles.stepTitle}>Personal Information</Text>
            <Text style={styles.stepDesc}>Your details are used to verify your identity for parking and fines.</Text>

            <FieldLabel label="Full Name" required />
            <View style={[styles.inputWrap, errors.fullName && styles.inputError]}>
              <Icon name="account-outline" size={18} color={Colors.muted} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="As on your citizenship card"
                placeholderTextColor={Colors.muted}
                value={fullName}
                onChangeText={t => { setFullName(t); setErrors(e => ({ ...e, fullName: '' })); }}
                autoCapitalize="words"
              />
            </View>
            {errors.fullName ? <ErrorMsg msg={errors.fullName} /> : null}

            <FieldLabel label="National ID / Citizenship Number" required />
            <View style={[styles.inputWrap, errors.nationalId && styles.inputError]}>
              <Icon name="card-account-details-outline" size={18} color={Colors.muted} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. 1234-56789-01234"
                placeholderTextColor={Colors.muted}
                value={nationalId}
                onChangeText={t => { setNationalId(t); setErrors(e => ({ ...e, nationalId: '' })); }}
                autoCapitalize="none"
              />
            </View>
            {errors.nationalId ? <ErrorMsg msg={errors.nationalId} /> : null}

            <FieldLabel label="Phone Number" />
            <View style={styles.inputWrap}>
              <Icon name="phone-outline" size={18} color={Colors.muted} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Optional — for fine notifications"
                placeholderTextColor={Colors.muted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <FieldLabel label="Password" required />
            <View style={[styles.inputWrap, errors.password && styles.inputError]}>
              <Icon name="lock-outline" size={18} color={Colors.muted} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="At least 6 characters"
                placeholderTextColor={Colors.muted}
                value={password}
                onChangeText={t => { setPassword(t); setErrors(e => ({ ...e, password: '' })); }}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
                <Icon name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.muted} />
              </TouchableOpacity>
            </View>
            {errors.password ? <ErrorMsg msg={errors.password} /> : null}

            <TouchableOpacity
              style={[styles.btn, (fullName.trim().length < 3 || nationalId.trim().length < 5 || password.length < 6) && styles.btnDisabled]}
              onPress={() => { if (validateStep1()) setStep(2); }}
            >
              <Text style={styles.btnText}>Next — Add Vehicles</Text>
              <Icon name="arrow-right" size={18} color={Colors.white} />
            </TouchableOpacity>
          </>
        )}

        {/* ══════════ STEP 2 — Vehicle ══════════ */}
        {step === 2 && (
          <>
            <Text style={styles.stepTitle}>Your Vehicle</Text>
            <Text style={styles.stepDesc}>
              Add your primary vehicle to get started. You can add more number plates anytime from your Profile.
            </Text>

            {vehicles.length > 0 ? (
              /* ── Vehicle confirmed — show summary and continue ── */
              <>
                <View style={styles.addedCard}>
                  <Icon name="check-circle" size={22} color={Colors.green} />
                  <View style={{ flex: 1 }}>
                    <PlateBadge plate={vehicles[0].plateNumber} type={vehicles[0].vehicleType} />
                    <Text style={styles.addedLabel}>
                      {VEHICLE_TYPES.find(v => v.value === vehicles[0].vehicleType)?.label}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => { setVehicles([]); setOwnerConfirm(false); }}>
                    <Text style={styles.changeLink}>Change</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.laterNote}>
                  <Icon name="information-outline" size={14} color={Colors.primary} />
                  <Text style={styles.laterNoteText}>
                    Have more vehicles? Add them later from <Text style={{ fontWeight: '700' }}>Profile → My Vehicles</Text>.
                  </Text>
                </View>

                <TouchableOpacity style={styles.btn} onPress={() => setStep(3)}>
                  <Text style={styles.btnText}>Next — Review</Text>
                  <Icon name="arrow-right" size={18} color={Colors.white} />
                </TouchableOpacity>
              </>
            ) : (
              /* ── Add first vehicle form ── */
              <View style={styles.addVehicleCard}>
                {/* Vehicle type picker */}
                <FieldLabel label="Vehicle Type" required />
                <View style={styles.vehicleTypeGrid}>
                  {VEHICLE_TYPES.map(vt => (
                    <TouchableOpacity
                      key={vt.value}
                      style={[styles.typeCard, newType === vt.value && styles.typeCardActive]}
                      onPress={() => setNewType(vt.value)}
                    >
                      <Icon name={vt.icon as any} size={22} color={newType === vt.value ? Colors.white : Colors.muted} />
                      <Text style={[styles.typeCardLabel, newType === vt.value && { color: Colors.white }]}>{vt.label}</Text>
                      <Text style={[styles.typeCardRate, newType === vt.value && { color: 'rgba(255,255,255,0.8)' }]}>Rs {vt.rate}/hr</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Plate number */}
                <FieldLabel label="Number Plate" required />
                <View style={[styles.inputWrap, errors.plate && styles.inputError]}>
                  <Icon name="card-text-outline" size={18} color={Colors.muted} style={styles.icon} />
                  <TextInput
                    style={[styles.input, styles.plateInput]}
                    placeholder="e.g. BA 1 KHA 1234"
                    placeholderTextColor={Colors.muted}
                    value={newPlate}
                    onChangeText={t => { setNewPlate(t); setErrors(e => ({ ...e, plate: '' })); }}
                    autoCapitalize="characters"
                  />
                </View>
                <Text style={styles.hint}>Nepal format: BA 1 KHA 1234</Text>
                {errors.plate ? <ErrorMsg msg={errors.plate} /> : null}

                {/* Ownership confirmation */}
                <TouchableOpacity
                  style={styles.checkRow}
                  onPress={() => setOwnerConfirm(v => !v)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, ownerConfirm && styles.checkboxActive]}>
                    {ownerConfirm && <Icon name="check" size={12} color={Colors.white} />}
                  </View>
                  <Text style={styles.checkText}>
                    I confirm this plate <Text style={{ fontWeight: '700' }}>belongs to me</Text>. Entering another person's plate is an offence.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.addBtn, (!newPlate.trim() || !ownerConfirm) && styles.addBtnDisabled]}
                  onPress={addVehicle}
                  disabled={!newPlate.trim() || !ownerConfirm}
                >
                  <Icon name="check" size={18} color={newPlate.trim() && ownerConfirm ? Colors.primary : Colors.muted} />
                  <Text style={[styles.addBtnText, (!newPlate.trim() || !ownerConfirm) && { color: Colors.muted }]}>
                    Confirm Vehicle
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* ══════════ STEP 3 — Review & Submit ══════════ */}
        {step === 3 && (
          <>
            <Text style={styles.stepTitle}>Review & Confirm</Text>
            <Text style={styles.stepDesc}>Please review your details before creating your account.</Text>

            {/* Personal summary card */}
            <View style={styles.reviewCard}>
              <Text style={styles.reviewCardTitle}>Personal Details</Text>
              <ReviewRow icon="account-outline"           label="Full Name"   value={fullName} />
              <ReviewRow icon="card-account-details-outline" label="National ID" value={nationalId} />
              {phone ? <ReviewRow icon="phone-outline" label="Phone" value={phone} /> : null}
            </View>

            {/* Vehicles summary card */}
            <View style={styles.reviewCard}>
              <Text style={styles.reviewCardTitle}>Vehicles ({vehicles.length})</Text>
              {vehicles.map(v => (
                <View key={v.plateNumber} style={styles.reviewVehicleRow}>
                  <PlateBadge plate={v.plateNumber} type={v.vehicleType} />
                  {v.isPrimary && (
                    <View style={styles.primaryBadge}><Text style={styles.primaryBadgeText}>Primary</Text></View>
                  )}
                </View>
              ))}
            </View>

            {/* Security notice */}
            <View style={styles.noticeBanner}>
              <Icon name="shield-check-outline" size={16} color={Colors.primary} />
              <Text style={styles.noticeText}>
                Your National ID is used to verify identity during parking checks and fine resolution. It is stored securely.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <>
                    <Text style={styles.btnText}>Create Account</Text>
                    <Icon name="check" size={18} color={Colors.white} />
                  </>
              }
            </TouchableOpacity>

            <Text style={styles.terms}>
              By registering you agree to NSP's terms of service and privacy policy.
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ReviewRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Icon name={icon as any} size={15} color={Colors.muted} />
      <View>
        <Text style={styles.reviewLabel}>{label}</Text>
        <Text style={styles.reviewValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.xxl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },

  // Step progress bar
  stepBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: 0,
  },
  stepItem:      { flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive:  { backgroundColor: Colors.primary },
  stepDotText:    { fontSize: 11, fontWeight: '700', color: Colors.muted },
  stepLabel:      { fontSize: 11, color: Colors.muted, marginLeft: 4, marginRight: 4 },
  stepLabelActive:{ color: Colors.primary, fontWeight: '700' },
  stepLine:       { width: 24, height: 2, backgroundColor: Colors.border },
  stepLineActive: { backgroundColor: Colors.primary },

  body: { padding: Spacing.lg, paddingBottom: Spacing.xxl },

  stepTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  stepDesc:  { fontSize: 13, color: Colors.muted, marginBottom: Spacing.lg, lineHeight: 18 },

  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: Spacing.xs, marginTop: Spacing.md },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, backgroundColor: Colors.light,
  },
  inputError: { borderColor: Colors.red },
  icon:    { paddingLeft: Spacing.md },
  eyeBtn:  { padding: Spacing.md },
  input: {
    flex: 1, paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md + 2,
    fontSize: 15, color: Colors.text,
  },
  plateInput: { fontWeight: '700', letterSpacing: 1 },
  hint: { fontSize: 11, color: Colors.muted, marginTop: 3 },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  errorText: { fontSize: 12, color: Colors.red, flex: 1 },

  btn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, marginTop: Spacing.xl,
  },
  btnDisabled: { backgroundColor: Colors.muted },
  btnText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  // Vehicles
  addedCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.greenLight, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.green,
    marginBottom: Spacing.md,
  },
  addedLabel: { fontSize: 12, color: Colors.muted, marginTop: 4 },
  changeLink: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  laterNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.sm,
    padding: Spacing.sm + 2, marginBottom: Spacing.sm,
  },
  laterNoteText: { fontSize: 12, color: Colors.primary, flex: 1, lineHeight: 17 },

  primaryBadge: {
    backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: BorderRadius.pill,
  },
  primaryBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  setPrimaryBtn:    { fontSize: 12, color: Colors.primary, fontWeight: '600' },

  addVehicleCard: {
    backgroundColor: Colors.light, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    marginTop: Spacing.sm,
  },
  addVehicleTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },

  vehicleTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.sm },
  typeCard: {
    width: '47%', alignItems: 'center', gap: 4, paddingVertical: 10,
    borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  typeCardActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeCardLabel:  { fontSize: 11, fontWeight: '700', color: Colors.muted, textAlign: 'center' },
  typeCardRate:   { fontSize: 10, color: Colors.muted },

  checkRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFF8E1', borderRadius: BorderRadius.sm,
    padding: Spacing.sm + 2, marginTop: Spacing.sm,
    borderWidth: 1, borderColor: '#FFE082',
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 2, borderColor: Colors.muted,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  checkboxActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  checkText:      { fontSize: 12, color: Colors.text, flex: 1, lineHeight: 17 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 10, marginTop: Spacing.md, backgroundColor: Colors.primaryLight,
  },
  addBtnDisabled: { borderColor: Colors.border, backgroundColor: Colors.light },
  addBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primary },

  // Plate badge
  plateBadge:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  plateBox: {
    flexDirection: 'row', alignItems: 'stretch',
    borderWidth: 1.5, borderColor: '#CCC',
    borderRadius: 5, overflow: 'hidden', backgroundColor: Colors.white,
  },
  plateBlueBar: { width: 5, backgroundColor: '#1A56DB' },
  plateText: {
    paddingHorizontal: 10, paddingVertical: 4,
    fontSize: 14, fontWeight: '800', color: Colors.text, letterSpacing: 1,
  },

  // Review
  reviewCard: {
    backgroundColor: Colors.light, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  reviewCardTitle: { fontSize: 13, fontWeight: '700', color: Colors.muted, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  reviewRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  reviewLabel:     { fontSize: 11, color: Colors.muted },
  reviewValue:     { fontSize: 14, fontWeight: '600', color: Colors.text },
  reviewVehicleRow:{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.sm },

  noticeBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.sm,
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  noticeText: { fontSize: 12, color: Colors.primary, flex: 1, lineHeight: 17 },

  terms: { fontSize: 11, color: Colors.muted, textAlign: 'center', marginTop: Spacing.md, lineHeight: 16 },
});
