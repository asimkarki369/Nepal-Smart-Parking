import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  StatusBar, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors, Spacing, BorderRadius } from '@/utils/theme';
import { useStore } from '@/store/useStore';
import { authAPI } from '@/services/api';
import { RootStackParamList } from '@/navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<NavProp>();
  const { setUser } = useStore();

  const [nationalId, setNationalId] = useState('');
  const [password,   setPassword]   = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [errors,     setErrors]     = useState<Record<string, string>>({});

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
    } catch {
      // Dev fallback — load saved account from AsyncStorage
      const saved = await AsyncStorage.getItem('nsp_user');
      if (saved) {
        const user = JSON.parse(saved);
        if (user.nationalId === nationalId.trim()) {
          await AsyncStorage.setItem('auth_token', 'dev_token');
          setUser(user);
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

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
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
