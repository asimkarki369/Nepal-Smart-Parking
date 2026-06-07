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
  { id: 'OFF-KMC-001', name: 'Ram Bahadur Thapa',    zone: 'Z-KMC-01', badge: 'KMC-001', password: 'officer123' },
  { id: 'OFF-KMC-002', name: 'Sita Kumari Shrestha', zone: 'Z-KMC-04', badge: 'KMC-002', password: 'officer123' },
  { id: 'OFF-PMC-001', name: 'Hari Prasad Karki',    zone: 'Z-PMC-01', badge: 'PMC-001', password: 'officer123' },
];

export default function OfficerLoginScreen() {
  const navigation = useNavigation<NavProp>();
  const insets     = useSafeAreaInsets();
  const { setOfficer } = useStore();

  const [officerId,  setOfficerId]  = useState('');
  const [password,   setPassword]   = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const handleLogin = async () => {
    if (!officerId.trim() || !password) {
      setError('Enter your Officer ID and password.');
      return;
    }
    setLoading(true);
    setError('');

    // Simulate API call
    await new Promise(r => setTimeout(r, 800));

    const officer = MOCK_OFFICERS.find(
      o => o.id.toUpperCase() === officerId.trim().toUpperCase() && o.password === password,
    );

    if (!officer) {
      setError('Invalid Officer ID or password. Please try again.');
      setLoading(false);
      return;
    }

    setOfficer({
      id:          officer.id,
      name:        officer.name,
      zone:        officer.zone,
      badgeNumber: officer.badge,
    });
    setLoading(false);
    // Navigator will auto-switch to Officer stack
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="#E65100" translucent />

      {/* Header */}
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

        {error ? (
          <View style={styles.errorRow}>
            <Icon name="alert-circle-outline" size={14} color={Colors.red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Login button */}
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

        {/* Hint */}
        <View style={styles.hintCard}>
          <Icon name="information-outline" size={15} color="#E65100" />
          <Text style={styles.hintText}>
            Officer IDs are issued by KMC/PMC enforcement. Contact your supervisor if you cannot log in.
          </Text>
        </View>

        {/* Dev hint */}
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

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.sm },
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
});
