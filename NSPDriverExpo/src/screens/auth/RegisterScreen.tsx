import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  StatusBar, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors, Spacing, BorderRadius, Typography } from '@/utils/theme';
import { authAPI } from '@/services/api';
import { useStore } from '@/store/useStore';
import { RootStackParamList } from '@/navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;
type RegRoute = RouteProp<RootStackParamList, 'Register'>;

const VEHICLE_TYPES = [
  { value: '2w'  as const, label: 'Bike / Scooter',   icon: 'motorbike',      rate: 25 },
  { value: '4w'  as const, label: 'Car / Jeep',       icon: 'car',            rate: 50 },
  { value: 'ev'  as const, label: 'Electric Vehicle', icon: 'lightning-bolt', rate: 35 },
  { value: 'bus' as const, label: 'Bus / Minibus',    icon: 'bus',            rate: 75 },
];

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={styles.label}>
      {label}
      {required && <Text style={styles.required}> *</Text>}
    </Text>
  );
}

export default function RegisterScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RegRoute>();
  const { phone } = route.params;
  const { setUser } = useStore();

  const [fullName, setFullName] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleType, setVehicleType] = useState<'2w' | '4w' | 'ev' | 'bus'>('2w');
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length < 3) {
      e.fullName = 'Full name must be at least 3 characters.';
    }
    // Nepal plate: Ba 1 Kha 1234 or similar — allow letters, digits, spaces
    const plate = plateNumber.trim().toUpperCase();
    if (!plate || plate.length < 4) {
      e.plateNumber = 'Enter a valid vehicle plate number.';
    }
    if (!ownershipConfirmed) {
      e.ownership = 'You must confirm this plate belongs to your vehicle.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authAPI.register({
        phone,
        fullName: fullName.trim(),
        plateNumber: plateNumber.trim().toUpperCase(),
        vehicleType,
      });
      const { token, user } = res.data;
      await AsyncStorage.setItem('auth_token', token);
      setUser(user);
    } catch (err: any) {
      const status  = err?.response?.status;
      const message = err?.response?.data?.message ?? '';

      // Backend signals plate already registered → show specific error
      if (status === 409 || message.toLowerCase().includes('plate')) {
        setErrors(e => ({
          ...e,
          plateNumber:
            'This plate number is already registered to another account. ' +
            'If this is your vehicle, contact support.',
        }));
        setLoading(false);
        return;
      }

      // Dev fallback — only when backend is unreachable (no response at all)
      if (!err?.response) {
        const devUser = {
          id: `dev_${Date.now()}`,
          fullName: fullName.trim(),
          phone,
          plateNumber: plateNumber.trim().toUpperCase(),
          vehicleType,
          walletBalance: 0,
          plateVerified: false,   // unverified until backend confirms Bluebook
        };
        await AsyncStorage.setItem('auth_token', 'dev_token');
        setUser(devUser);
      } else {
        setErrors(e => ({
          ...e,
          plateNumber: message || 'Registration failed. Please try again.',
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  const isFormReady = fullName.trim().length >= 3 && plateNumber.trim().length >= 4 && ownershipConfirmed;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Account</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Progress indicator */}
        <View style={styles.progressRow}>
          <View style={styles.stepDone}>
            <Icon name="check" size={12} color={Colors.white} />
          </View>
          <View style={styles.progressLine} />
          <View style={styles.stepDone}>
            <Icon name="check" size={12} color={Colors.white} />
          </View>
          <View style={styles.progressLine} />
          <View style={styles.stepActive}>
            <Text style={styles.stepActiveText}>3</Text>
          </View>
        </View>
        <Text style={styles.progressLabel}>Step 3 of 3 — Your details</Text>

        {/* Phone badge (read-only) */}
        <View style={styles.phoneBadge}>
          <Icon name="check-circle" size={16} color={Colors.green} />
          <Text style={styles.phoneBadgeText}>Verified: +977 {phone}</Text>
        </View>

        {/* Full name */}
        <FieldLabel label="Full Name" required />
        <View style={[styles.inputWrapper, errors.fullName ? styles.inputError : null]}>
          <Icon name="account-outline" size={18} color={Colors.muted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="As on your ID (e.g. Ram Prasad Sharma)"
            placeholderTextColor={Colors.muted}
            value={fullName}
            onChangeText={t => { setFullName(t); setErrors(e => ({ ...e, fullName: '' })); }}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>
        {errors.fullName ? <ErrorMsg msg={errors.fullName} /> : null}

        {/* Plate number */}
        <FieldLabel label="Vehicle Plate Number" required />
        <View style={[styles.inputWrapper, errors.plateNumber ? styles.inputError : null]}>
          <Icon name="card-text-outline" size={18} color={Colors.muted} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, styles.plateInput]}
            placeholder="e.g. BA 1 KHA 1234"
            placeholderTextColor={Colors.muted}
            value={plateNumber}
            onChangeText={t => { setPlateNumber(t); setErrors(e => ({ ...e, plateNumber: '' })); }}
            autoCapitalize="characters"
            returnKeyType="done"
          />
        </View>
        {errors.plateNumber ? <ErrorMsg msg={errors.plateNumber} /> : null}
        <Text style={styles.hint}>Nepal Bagmati format: BA 1 KHA 1234</Text>

        {/* Ownership confirmation */}
        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => {
            setOwnershipConfirmed(v => !v);
            setErrors(e => ({ ...e, ownership: '' }));
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, ownershipConfirmed && styles.checkboxActive]}>
            {ownershipConfirmed && <Icon name="check" size={12} color={Colors.white} />}
          </View>
          <Text style={styles.checkText}>
            I confirm this plate number belongs to <Text style={{ fontWeight: '700' }}>my vehicle</Text>.
            Entering another person's plate is an offence and fines will be traced back to this account.
          </Text>
        </TouchableOpacity>
        {errors.ownership ? <ErrorMsg msg={errors.ownership} /> : null}

        {/* Vehicle type */}
        <FieldLabel label="Vehicle Type" required />
        <View style={styles.vehicleRow}>
          {VEHICLE_TYPES.map(vt => (
            <TouchableOpacity
              key={vt.value}
              style={[styles.vehicleCard, vehicleType === vt.value && styles.vehicleCardActive]}
              onPress={() => setVehicleType(vt.value)}
              activeOpacity={0.8}
            >
              <Icon
                name={vt.icon}
                size={28}
                color={vehicleType === vt.value ? Colors.primary : Colors.muted}
              />
              <Text style={[styles.vehicleLabel, vehicleType === vt.value && styles.vehicleLabelActive]}>
                {vt.label}
              </Text>
              {vehicleType === vt.value && (
                <View style={styles.vehicleCheck}>
                  <Icon name="check" size={10} color={Colors.white} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Rate info */}
        <View style={styles.rateCard}>
          <Icon name="information-outline" size={15} color={Colors.primary} />
          <Text style={styles.rateText}>
            {vehicleType === '4w' ? 'Car/Jeep (petrol/diesel): Rs 50/hr + 10% service fee'
              : vehicleType === 'ev' ? 'Electric Vehicle: Rs 35/hr + 10% service fee'
              : vehicleType === 'bus' ? 'Bus/Minivan/Minibus: Rs 75/hr + 10% service fee'
              : 'Bike/Scooter: Rs 25/hr + 10% service fee'}
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.btn, (!isFormReady || loading) && styles.btnDisabled]}
          onPress={handleRegister}
          disabled={!isFormReady || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              <Text style={styles.btnText}>Complete Registration</Text>
              <Icon name="arrow-right" size={18} color={Colors.white} />
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.terms}>
          Your vehicle details are used only for parking session management.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },

  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Spacing.xxl + 8, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.white },

  body: {
    paddingHorizontal: Spacing.lg + 4,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },

  progressRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 0, marginBottom: Spacing.xs,
  },
  stepDone: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.green,
    alignItems: 'center', justifyContent: 'center',
  },
  stepActive: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  stepActiveText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  progressLine: { width: 32, height: 2, backgroundColor: Colors.green },
  progressLabel: {
    fontSize: 12, color: Colors.muted, textAlign: 'center', marginBottom: Spacing.lg,
  },

  phoneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#E8F5E9', borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  phoneBadgeText: { fontSize: 13, color: Colors.text, fontWeight: '600' },

  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: Spacing.xs, marginTop: Spacing.md },
  required: { color: Colors.red },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light,
  },
  inputError: { borderColor: Colors.red },
  inputIcon: { paddingLeft: Spacing.md },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md + 2,
    fontSize: 15, color: Colors.text,
  },
  plateInput: { fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },

  hint: { fontSize: 11, color: Colors.muted, marginTop: 4 },

  checkRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    marginTop: Spacing.md,
    backgroundColor: '#FFF8E1',
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm + 2,
    borderWidth: 1, borderColor: '#FFE082',
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 2, borderColor: Colors.muted,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  checkboxActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  checkText: { fontSize: 12, color: Colors.text, flex: 1, lineHeight: 17 },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  errorText: { fontSize: 12, color: Colors.red, flex: 1 },

  vehicleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  vehicleCard: {
    width: '47%',
    flex: 1, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, padding: Spacing.md,
    alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.light, position: 'relative',
  },
  vehicleCardActive: { borderColor: Colors.primary, backgroundColor: '#EEF2FB' },
  vehicleLabel: { fontSize: 11, color: Colors.muted, textAlign: 'center', fontWeight: '500' },
  vehicleLabelActive: { color: Colors.primary, fontWeight: '700' },
  vehicleCheck: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  rateCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#EEF2FB', borderRadius: BorderRadius.sm,
    padding: Spacing.sm + 2, marginTop: Spacing.sm,
  },
  rateText: { fontSize: 12, color: Colors.primary, flex: 1, lineHeight: 18 },

  btn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  btnDisabled: { backgroundColor: Colors.muted },
  btnText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  terms: { fontSize: 11, color: Colors.muted, textAlign: 'center', marginTop: Spacing.md, lineHeight: 16 },
});
