import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  StatusBar, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { Colors, Spacing, BorderRadius, Typography } from '@/utils/theme';
import { authAPI } from '@/services/api';
import { RootStackParamList } from '@/navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<NavProp>();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValid = phone.length === 10 && /^(97|98)\d{8}$/.test(phone);

  const handleSendOTP = async () => {
    if (!isValid) {
      setError('Enter a valid 10-digit Nepal mobile number (starting with 97 or 98).');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authAPI.sendOTP(phone);
      navigation.navigate('OTP', { phone });
    } catch {
      // Backend not live yet — navigate anyway for development
      navigation.navigate('OTP', { phone });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header band */}
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Icon name="parking" size={36} color={Colors.primary} />
        </View>
        <Text style={styles.appName}>Nepal Smart Parking</Text>
        <Text style={styles.tagline}>Find. Park. Pay. — in seconds.</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Enter your mobile number to continue</Text>

        {/* Phone input */}
        <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
          <View style={styles.prefix}>
            <Text style={styles.prefixText}>🇳🇵  +977</Text>
          </View>
          <View style={styles.divider} />
          <TextInput
            style={styles.input}
            placeholder="98XXXXXXXX"
            placeholderTextColor={Colors.muted}
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={t => { setPhone(t.replace(/\D/g, '')); setError(''); }}
          />
        </View>

        {error ? (
          <View style={styles.errorRow}>
            <Icon name="alert-circle-outline" size={14} color={Colors.red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Send OTP button */}
        <TouchableOpacity
          style={[styles.btn, (!isValid || loading) && styles.btnDisabled]}
          onPress={handleSendOTP}
          disabled={!isValid || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              <Text style={styles.btnText}>Send OTP</Text>
              <Icon name="arrow-right" size={18} color={Colors.white} />
            </>
          )}
        </TouchableOpacity>

        {/* Terms */}
        <Text style={styles.terms}>
          By continuing, you agree to NSP's{' '}
          <Text style={styles.termsLink}>Terms of Service</Text>
          {' '}and{' '}
          <Text style={styles.termsLink}>Privacy Policy</Text>.
        </Text>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Icon name="shield-check-outline" size={14} color={Colors.muted} />
        <Text style={styles.footerText}>Your data is secure and never shared.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },

  header: {
    backgroundColor: Colors.primary,
    paddingTop: Spacing.xxl + 20,
    paddingBottom: Spacing.xxl + 8,
    alignItems: 'center',
    gap: Spacing.sm,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  appName: { fontSize: 22, fontWeight: '800', color: Colors.white, letterSpacing: 0.3 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },

  body: {
    paddingHorizontal: Spacing.lg + 4,
    paddingTop: Spacing.xl + 8,
    paddingBottom: Spacing.xl,
  },
  title: { ...Typography.h2, marginBottom: Spacing.xs },
  subtitle: { ...Typography.small, marginBottom: Spacing.xl },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, overflow: 'hidden',
    backgroundColor: Colors.light,
  },
  inputError: { borderColor: Colors.red },
  prefix: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md + 2,
    backgroundColor: Colors.light,
  },
  prefixText: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  divider: { width: 1, height: '100%', backgroundColor: Colors.border },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md + 2,
    fontSize: 16, color: Colors.text,
    fontWeight: '600', letterSpacing: 1.5,
  },

  errorRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 5, marginTop: Spacing.sm,
  },
  errorText: { fontSize: 12, color: Colors.red, flex: 1 },

  btn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  btnDisabled: { backgroundColor: Colors.muted },
  btnText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  terms: {
    fontSize: 11, color: Colors.muted,
    textAlign: 'center', marginTop: Spacing.lg,
    lineHeight: 17,
  },
  termsLink: { color: Colors.primary, fontWeight: '600' },

  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  footerText: { fontSize: 11, color: Colors.muted },
});
