import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  StatusBar, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing, BorderRadius } from '@/utils/theme';
import { useStore } from '@/store/useStore';
import { RootStackParamList } from '@/navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'OfficerLogin'>;

// Mock officer credentials — replace with real API
const MOCK_OFFICERS = [
  {
    id: 'OFF-KMC-001', name: 'Ram Bahadur Thapa',    zone: 'Z-KMC-01', badge: 'KMC-001',
    password: 'officer123', nationalId: 'N111111111', citizenshipNo: 'CHT-001-KTM',
  },
  {
    id: 'OFF-KMC-002', name: 'Sita Kumari Shrestha', zone: 'Z-KMC-04', badge: 'KMC-002',
    password: 'officer123', nationalId: 'N222222222', citizenshipNo: 'CHT-002-KTM',
  },
  {
    id: 'OFF-PMC-001', name: 'Hari Prasad Karki',    zone: 'Z-PMC-01', badge: 'PMC-001',
    password: 'officer123', nationalId: 'N333333333', citizenshipNo: 'CHT-001-PKR',
  },
];

type Step = 'login' | 'recover' | 'recovered';

export default function OfficerLoginScreen() {
  const navigation = useNavigation<NavProp>();
  const insets     = useSafeAreaInsets();
  const { setOfficer } = useStore();

  // Login state
  const [officerId,  setOfficerId]  = useState('');
  const [password,   setPassword]   = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  // Recovery state
  const [step,          setStep]          = useState<Step>('login');
  const [recNationalId, setRecNationalId] = useState('');
  const [recCitizen,    setRecCitizen]    = useState('');
  const [recLoading,    setRecLoading]    = useState(false);
  const [recError,      setRecError]      = useState('');
  const [recoveredOfficer, setRecoveredOfficer] = useState<typeof MOCK_OFFICERS[0] | null>(null);

  const handleLogin = async () => {
    if (!officerId.trim() || !password) {
      setError('Enter your Officer ID and password.');
      return;
    }
    setLoading(true);
    setError('');

    await new Promise(r => setTimeout(r, 800));

    const officer = MOCK_OFFICERS.find(
      o => o.id.toUpperCase() === officerId.trim().toUpperCase() && o.password === password,
    );

    if (!officer) {
      setError('Invalid Officer ID or password. Please try again.');
      setLoading(false);
      return;
    }

    setOfficer({ id: officer.id, name: officer.name, zone: officer.zone, badgeNumber: officer.badge });
    setLoading(false);
  };

  const handleRecover = async () => {
    if (!recNationalId.trim() || !recCitizen.trim()) {
      setRecError('Both National ID and Citizenship Number are required.');
      return;
    }
    setRecLoading(true);
    setRecError('');

    await new Promise(r => setTimeout(r, 900));

    const match = MOCK_OFFICERS.find(
      o =>
        o.nationalId.toUpperCase()   === recNationalId.trim().toUpperCase() &&
        o.citizenshipNo.toUpperCase() === recCitizen.trim().toUpperCase(),
    );

    if (!match) {
      setRecError('No officer account found matching these credentials. Contact your supervisor.');
      setRecLoading(false);
      return;
    }

    setRecoveredOfficer(match);
    setRecLoading(false);
    setStep('recovered');
  };

  const resetToLogin = () => {
    setStep('login');
    setRecNationalId('');
    setRecCitizen('');
    setRecError('');
    setRecoveredOfficer(null);
    if (recoveredOfficer) setOfficerId(recoveredOfficer.id);
  };

  // ── RECOVERY SUCCESS ───────────────────────────────────────────────────────
  if (step === 'recovered' && recoveredOfficer) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor="#E65100" translucent />
        <View style={styles.header}>
          <TouchableOpacity onPress={resetToLogin} style={styles.backBtn}>
            <Icon name="arrow-left" size={22} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.shieldWrap}>
              <Icon name="shield-check" size={32} color={Colors.green} />
            </View>
            <Text style={styles.headerTitle}>Identity Verified</Text>
            <Text style={styles.headerSub}>Your account has been found</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.recoveredCard}>
            <View style={styles.recoveredBadge}>
              <Icon name="account-check" size={28} color={Colors.green} />
            </View>
            <Text style={styles.recoveredName}>{recoveredOfficer.name}</Text>
            <Text style={styles.recoveredSub}>Officer — Badge {recoveredOfficer.badge}</Text>
          </View>

          <View style={styles.credentialCard}>
            <Text style={styles.credentialTitle}>YOUR LOGIN CREDENTIALS</Text>

            <View style={styles.credentialRow}>
              <View style={styles.credentialIconBox}>
                <Icon name="badge-account-outline" size={18} color="#E65100" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.credentialLabel}>Officer ID</Text>
                <Text style={styles.credentialValue}>{recoveredOfficer.id}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setOfficerId(recoveredOfficer.id)}
                style={styles.copyBtn}
              >
                <Icon name="content-copy" size={14} color={Colors.primary} />
                <Text style={styles.copyBtnText}>Copy</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.credentialDivider} />

            <View style={styles.credentialRow}>
              <View style={styles.credentialIconBox}>
                <Icon name="lock-outline" size={18} color="#E65100" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.credentialLabel}>Temporary Password</Text>
                <Text style={styles.credentialValue}>{recoveredOfficer.password}</Text>
              </View>
            </View>
          </View>

          <View style={styles.recNotice}>
            <Icon name="information-outline" size={15} color="#E65100" />
            <Text style={styles.recNoticeText}>
              Please change your password after logging in. Contact your supervisor if you still cannot access your account.
            </Text>
          </View>

          <TouchableOpacity style={styles.loginBtn} onPress={resetToLogin}>
            <Icon name="login" size={18} color={Colors.white} />
            <Text style={styles.loginBtnText}>Go to Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── RECOVERY FORM ──────────────────────────────────────────────────────────
  if (step === 'recover') {
    return (
      <KeyboardAvoidingView
        style={[styles.root, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StatusBar barStyle="light-content" backgroundColor="#E65100" translucent />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setStep('login'); setRecError(''); }} style={styles.backBtn}>
            <Icon name="arrow-left" size={22} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.shieldWrap}>
              <Icon name="shield-key" size={32} color="#E65100" />
            </View>
            <Text style={styles.headerTitle}>Recover Access</Text>
            <Text style={styles.headerSub}>Verify your identity to regain access</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.recInfoCard}>
            <Icon name="information-outline" size={18} color={Colors.primary} />
            <Text style={styles.recInfoText}>
              Enter your <Text style={{ fontWeight: '800' }}>National ID</Text> and{' '}
              <Text style={{ fontWeight: '800' }}>Citizenship Number</Text> exactly as registered
              with Nepal Smart Parking.
            </Text>
          </View>

          <Text style={styles.label}>National ID Number</Text>
          <View style={[styles.inputRow, recError && !recNationalId.trim() && styles.inputError]}>
            <Icon name="card-account-details-outline" size={18} color={Colors.muted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. N123456789"
              placeholderTextColor={Colors.muted}
              value={recNationalId}
              onChangeText={t => { setRecNationalId(t); setRecError(''); }}
              autoCapitalize="characters"
              returnKeyType="next"
            />
          </View>

          <Text style={styles.label}>Citizenship Number</Text>
          <View style={[styles.inputRow, recError && !recCitizen.trim() && styles.inputError]}>
            <Icon name="certificate-outline" size={18} color={Colors.muted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. CHT-001-KTM"
              placeholderTextColor={Colors.muted}
              value={recCitizen}
              onChangeText={t => { setRecCitizen(t); setRecError(''); }}
              autoCapitalize="characters"
              returnKeyType="done"
              onSubmitEditing={handleRecover}
            />
          </View>

          {recError ? (
            <View style={styles.errorRow}>
              <Icon name="alert-circle-outline" size={14} color={Colors.red} />
              <Text style={styles.errorText}>{recError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.loginBtn, recLoading && styles.loginBtnDisabled]}
            onPress={handleRecover}
            disabled={recLoading}
          >
            {recLoading
              ? <ActivityIndicator color={Colors.white} />
              : <>
                  <Icon name="shield-search" size={18} color={Colors.white} />
                  <Text style={styles.loginBtnText}>Verify & Recover</Text>
                </>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.backLink} onPress={() => { setStep('login'); setRecError(''); }}>
            <Icon name="arrow-left" size={14} color={Colors.muted} />
            <Text style={styles.backLinkText}>Back to Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── LOGIN FORM (default) ───────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="#E65100" translucent />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.shieldWrap}>
            <Icon name="shield-star" size={32} color="#E65100" />
          </View>
          <Text style={styles.headerTitle}>Officer Login</Text>
          <Text style={styles.headerSub}>Nepal Smart Parking — Enforcement</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>Officer ID</Text>
        <View style={[styles.inputRow, error && !officerId && styles.inputError]}>
          <Icon name="badge-account-outline" size={18} color={Colors.muted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="e.g. OFF-KMC-001"
            placeholderTextColor={Colors.muted}
            value={officerId}
            onChangeText={t => { setOfficerId(t); setError(''); }}
            autoCapitalize="characters"
            returnKeyType="next"
          />
        </View>

        <Text style={styles.label}>Password</Text>
        <View style={[styles.inputRow, error && !password && styles.inputError]}>
          <Icon name="lock-outline" size={18} color={Colors.muted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor={Colors.muted}
            value={password}
            onChangeText={t => { setPassword(t); setError(''); }}
            secureTextEntry={!showPass}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
          <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ padding: 10 }}>
            <Icon name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Forgot link */}
        <TouchableOpacity style={styles.forgotLink} onPress={() => setStep('recover')}>
          <Icon name="help-circle-outline" size={14} color="#E65100" />
          <Text style={styles.forgotLinkText}>Forgot ID or Password?</Text>
        </TouchableOpacity>

        {error ? (
          <View style={styles.errorRow}>
            <Icon name="alert-circle-outline" size={14} color={Colors.red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <>
                <Icon name="shield-check-outline" size={18} color={Colors.white} />
                <Text style={styles.loginBtnText}>Login as Officer</Text>
              </>
          }
        </TouchableOpacity>

        <View style={styles.hintCard}>
          <Icon name="information-outline" size={15} color="#E65100" />
          <Text style={styles.hintText}>
            Officer IDs are issued by KMC/PMC enforcement. Use "Forgot ID or Password?" to recover access using your National ID and Citizenship Number.
          </Text>
        </View>

        <Text style={styles.devHint}>Dev: ID = OFF-KMC-001 · Password = officer123</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },

  header: {
    backgroundColor: '#E65100',
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  headerCenter: { alignItems: 'center', marginTop: Spacing.md, gap: Spacing.sm },
  shieldWrap: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.white },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.75)' },

  body: { paddingHorizontal: Spacing.lg + 4, paddingTop: Spacing.xl, paddingBottom: Spacing.xl },

  label: { fontSize: 12, fontWeight: '700', color: Colors.text, marginBottom: Spacing.xs, marginTop: Spacing.md },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, backgroundColor: Colors.light,
  },
  inputError: { borderColor: Colors.red },
  inputIcon:  { paddingLeft: Spacing.md },
  input: {
    flex: 1, paddingVertical: Spacing.md + 2, paddingHorizontal: Spacing.sm,
    fontSize: 15, color: Colors.text,
  },

  forgotLink: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-end', marginTop: Spacing.sm, paddingVertical: 4,
  },
  forgotLinkText: { fontSize: 12, fontWeight: '700', color: '#E65100' },

  errorRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.sm },
  errorText: { fontSize: 12, color: Colors.red, flex: 1 },

  loginBtn: {
    backgroundColor: '#E65100', borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md + 2,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  loginBtnDisabled: { backgroundColor: Colors.muted },
  loginBtnText:     { fontSize: 15, fontWeight: '800', color: Colors.white },

  hintCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FFF3E0', borderRadius: BorderRadius.md,
    padding: Spacing.md, marginTop: Spacing.xl,
  },
  hintText: { fontSize: 12, color: '#E65100', flex: 1, lineHeight: 18 },

  devHint: { fontSize: 11, color: Colors.muted, textAlign: 'center', marginTop: Spacing.lg },

  // Recovery form
  recInfoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.primary + '40',
  },
  recInfoText: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 19 },

  backLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, marginTop: Spacing.md, paddingVertical: Spacing.sm,
  },
  backLinkText: { fontSize: 13, color: Colors.muted },

  // Recovery success
  recoveredCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, alignItems: 'center', gap: 6,
    borderWidth: 2, borderColor: Colors.green,
    shadowColor: Colors.green, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
    marginBottom: Spacing.md,
  },
  recoveredBadge: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.greenLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  recoveredName: { fontSize: 18, fontWeight: '800', color: Colors.text },
  recoveredSub:  { fontSize: 12, color: Colors.muted },

  credentialCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.md + 4, marginBottom: Spacing.md,
    borderWidth: 1.5, borderColor: '#FFB74D',
    shadowColor: '#E65100', shadowOpacity: 0.08, elevation: 2,
  },
  credentialTitle: {
    fontSize: 10, fontWeight: '800', color: Colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.md,
  },
  credentialRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  credentialIconBox:{
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#FFF3E0', alignItems: 'center', justifyContent: 'center',
  },
  credentialLabel:  { fontSize: 11, color: Colors.muted, fontWeight: '600' },
  credentialValue:  { fontSize: 16, fontWeight: '800', color: Colors.text, letterSpacing: 0.5, marginTop: 2 },
  credentialDivider:{ height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },

  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  copyBtnText: { fontSize: 11, fontWeight: '700', color: Colors.primary },

  recNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FFF3E0', borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.xl,
    borderWidth: 1, borderColor: '#FFB74D',
  },
  recNoticeText: { flex: 1, fontSize: 12, color: '#E65100', lineHeight: 18 },
});
