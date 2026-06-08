import React, { useState, useEffect, useCallback } from 'react';
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
import { useStore } from '@/store/useStore';
import { authAPI } from '@/services/api';
import { RootStackParamList } from '@/navigation/types';
import {
  isBiometricAvailable,
  isDriverBiometricEnabled,
  getBiometricLabel,
  getBiometricIcon,
  authenticateBiometric,
  saveDriverBiometric,
  getDriverBiometricCredentials,
  clearDriverBiometric,
} from '@/utils/biometricAuth';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<NavProp>();
  const { setUser } = useStore();

  const [nationalId,  setNationalId]  = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  // Biometric state
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled,   setBioEnabled]   = useState(false);
  const [bioLabel,     setBioLabel]     = useState('Biometric');
  const [bioIcon,      setBioIcon]      = useState('fingerprint');
  const [bioLoading,   setBioLoading]   = useState(false);

  // ── Check biometric support on mount ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const available = await isBiometricAvailable();
      if (!available) return;
      setBioAvailable(true);
      const [enabled, label, icon] = await Promise.all([
        isDriverBiometricEnabled(),
        getBiometricLabel(),
        getBiometricIcon(),
      ]);
      setBioEnabled(enabled);
      setBioLabel(label);
      setBioIcon(icon);
      // Auto-prompt if already enrolled
      if (enabled) triggerBiometric();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Core login logic (shared by password + biometric) ───────────────────────
  const loginWithCredentials = useCallback(async (id: string, pass: string) => {
    setLoading(true);
    try {
      const res = await authAPI.login({ nationalId: id.trim(), password: pass });
      const { token, user } = res.data;
      await AsyncStorage.setItem('auth_token', token);
      setUser(user);
    } catch {
      // Dev fallback — load saved account from AsyncStorage
      const saved = await AsyncStorage.getItem('nsp_user');
      if (saved) {
        const user = JSON.parse(saved);
        if (user.nationalId === id.trim()) {
          await AsyncStorage.setItem('auth_token', 'dev_token');
          setUser(user);
          return 'ok';
        }
        return 'not_found';
      }
      return 'no_account';
    } finally {
      setLoading(false);
    }
    return 'ok';
  }, [setUser]);

  // ── Password login ───────────────────────────────────────────────────────────
  const validate = () => {
    const e: Record<string, string> = {};
    if (nationalId.trim().length < 4) e.nationalId = 'Enter your National ID number.';
    if (password.length < 4)          e.password   = 'Enter your password.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authAPI.login({ nationalId: nationalId.trim(), password });
      const { token, user } = res.data;
      await AsyncStorage.setItem('auth_token', token);
      setUser(user);
      offerBiometricEnroll(nationalId.trim(), password);
    } catch {
      const saved = await AsyncStorage.getItem('nsp_user');
      if (saved) {
        const user = JSON.parse(saved);
        if (user.nationalId === nationalId.trim()) {
          await AsyncStorage.setItem('auth_token', 'dev_token');
          setUser(user);
          offerBiometricEnroll(nationalId.trim(), password);
        } else {
          setErrors({ nationalId: 'National ID not found. Please register first.' });
        }
      } else {
        setErrors({ nationalId: 'Account not found. Please register first.' });
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Biometric login ──────────────────────────────────────────────────────────
  const triggerBiometric = useCallback(async () => {
    if (bioLoading) return;
    setBioLoading(true);
    try {
      const passed = await authenticateBiometric('Sign in to Nepal Smart Parking');
      if (!passed) return;
      const creds = await getDriverBiometricCredentials();
      if (!creds) {
        Alert.alert('Setup Required', 'Please sign in with your password once to re-enable biometric login.');
        await clearDriverBiometric();
        setBioEnabled(false);
        return;
      }
      const result = await loginWithCredentials(creds.nationalId, creds.password);
      if (result === 'not_found' || result === 'no_account') {
        Alert.alert('Biometric Login Failed', 'Your saved credentials are no longer valid. Please log in with your password.');
        await clearDriverBiometric();
        setBioEnabled(false);
      }
    } catch {
      // silently ignore hardware errors
    } finally {
      setBioLoading(false);
    }
  }, [bioLoading, loginWithCredentials]);

  // ── Offer to enable biometric after first password login ─────────────────────
  const offerBiometricEnroll = async (id: string, pass: string) => {
    if (!bioAvailable || bioEnabled) return;
    Alert.alert(
      `Enable ${bioLabel} Login?`,
      `Sign in faster next time using your ${bioLabel.toLowerCase()} — no need to enter your password.`,
      [
        { text: 'Not Now', style: 'cancel' },
        {
          text: 'Enable',
          onPress: async () => {
            await saveDriverBiometric(id, pass);
            setBioEnabled(true);
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Logo / brand */}
        <View style={styles.brand}>
          <View style={styles.logoBox}>
            <Icon name="alpha-p-box" size={40} color={Colors.white} />
          </View>
          <Text style={styles.brandName}>Nepal Smart Parking</Text>
          <Text style={styles.brandSub}>Sign in to your account</Text>
        </View>

        {/* Biometric quick-login (shown when enrolled) */}
        {bioAvailable && bioEnabled && (
          <TouchableOpacity
            style={styles.bioQuickBtn}
            onPress={triggerBiometric}
            activeOpacity={0.8}
            disabled={bioLoading}
          >
            {bioLoading ? (
              <ActivityIndicator color={Colors.primary} size="small" />
            ) : (
              <>
                <Icon name={bioIcon as any} size={28} color={Colors.primary} />
                <Text style={styles.bioQuickText}>Sign in with {bioLabel}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Divider */}
        {bioAvailable && bioEnabled && (
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or use password</Text>
            <View style={styles.dividerLine} />
          </View>
        )}

        {/* National ID */}
        <Text style={styles.label}>National ID Number</Text>
        <View style={[styles.inputWrap, errors.nationalId && styles.inputError]}>
          <Icon name="card-account-details-outline" size={18} color={Colors.muted} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Enter your citizenship / National ID"
            placeholderTextColor={Colors.muted}
            value={nationalId}
            onChangeText={t => { setNationalId(t); setErrors(e => ({ ...e, nationalId: '' })); }}
            autoCapitalize="none"
            returnKeyType="next"
          />
        </View>
        {errors.nationalId ? <ErrorMsg msg={errors.nationalId} /> : null}

        {/* Password */}
        <Text style={styles.label}>Password</Text>
        <View style={[styles.inputWrap, errors.password && styles.inputError]}>
          <Icon name="lock-outline" size={18} color={Colors.muted} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor={Colors.muted}
            value={password}
            onChangeText={t => { setPassword(t); setErrors(e => ({ ...e, password: '' })); }}
            secureTextEntry={!showPass}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
          <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
            <Icon name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.muted} />
          </TouchableOpacity>
        </View>
        {errors.password ? <ErrorMsg msg={errors.password} /> : null}

        {/* Login button */}
        <TouchableOpacity
          style={[styles.btn, (!nationalId || !password || loading) && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={!nationalId || !password || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={Colors.white} size="small" />
            : <Text style={styles.btnText}>Sign In</Text>
          }
        </TouchableOpacity>

        {/* Biometric setup prompt (shown when available but not yet enabled) */}
        {bioAvailable && !bioEnabled && (
          <View style={styles.bioSetupRow}>
            <Icon name={bioIcon as any} size={15} color={Colors.muted} />
            <Text style={styles.bioSetupText}>
              {bioLabel} login available — sign in with your password once to enable it.
            </Text>
          </View>
        )}

        {/* Register link */}
        <View style={styles.registerRow}>
          <Text style={styles.registerPrompt}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLink}>Register</Text>
          </TouchableOpacity>
        </View>

        {/* Officer link */}
        <TouchableOpacity
          style={styles.officerLink}
          onPress={() => navigation.navigate('OfficerLogin')}
        >
          <Icon name="shield-account-outline" size={15} color={Colors.muted} />
          <Text style={styles.officerLinkText}>Sign in as Parking Officer</Text>
        </TouchableOpacity>
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
  body: { padding: Spacing.lg + 4, paddingTop: Spacing.xxl * 2 },

  brand: { alignItems: 'center', marginBottom: Spacing.xxl + 8 },
  logoBox: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  brandName: { fontSize: 22, fontWeight: '800', color: Colors.text },
  brandSub:  { fontSize: 14, color: Colors.muted, marginTop: 4 },

  // ── Biometric quick-login button ────────────────────────────────────────────
  bioQuickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 2, borderColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md + 4,
    backgroundColor: Colors.primaryLight,
    marginBottom: Spacing.md,
  },
  bioQuickText: { fontSize: 15, fontWeight: '700', color: Colors.primary },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 12, color: Colors.muted },

  // ── Biometric setup hint ────────────────────────────────────────────────────
  bioSetupRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: Spacing.md,
    backgroundColor: Colors.light, borderRadius: BorderRadius.sm,
    padding: Spacing.sm + 2,
  },
  bioSetupText: { flex: 1, fontSize: 11, color: Colors.muted, lineHeight: 16 },

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

  errorRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  errorText: { fontSize: 12, color: Colors.red, flex: 1 },

  btn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 4,
    alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  btnDisabled: { backgroundColor: Colors.muted },
  btnText: { fontSize: 16, fontWeight: '700', color: Colors.white },

  registerRow:    { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.lg },
  registerPrompt: { fontSize: 14, color: Colors.muted },
  registerLink:   { fontSize: 14, fontWeight: '700', color: Colors.primary },

  officerLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: Spacing.xl, paddingVertical: Spacing.sm,
  },
  officerLinkText: { fontSize: 13, color: Colors.muted },
});
