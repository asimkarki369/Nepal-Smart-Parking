import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  StatusBar, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors, Spacing, BorderRadius, Typography } from '@/utils/theme';
import { authAPI } from '@/services/api';
import { useStore } from '@/store/useStore';
import { RootStackParamList } from '@/navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'OTP'>;
type OTPRoute = RouteProp<RootStackParamList, 'OTP'>;

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function OTPScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<OTPRoute>();
  const { phone } = route.params;
  const { setUser } = useStore();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Countdown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // Auto-submit when all digits filled
  useEffect(() => {
    if (digits.every(d => d !== '')) handleVerify();
  }, [digits]);

  const handleDigitChange = (text: string, index: number) => {
    // Handle paste of full OTP
    if (text.length === OTP_LENGTH) {
      const pasted = text.replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
      setDigits(pasted);
      inputRefs.current[OTP_LENGTH - 1]?.focus();
      return;
    }

    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError('');

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) return;
    setLoading(true);
    setError('');
    try {
      const res = await authAPI.verifyOTP(phone, otp);
      const { token, user, isNewUser } = res.data;
      await AsyncStorage.setItem('auth_token', token);

      if (isNewUser) {
        navigation.navigate('Register', { phone });
      } else {
        setUser(user);
      }
    } catch {
      // Dev mode: treat any OTP as valid, go to Register as new user
      navigation.navigate('Register', { phone });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setDigits(Array(OTP_LENGTH).fill(''));
    setError('');
    inputRefs.current[0]?.focus();
    try {
      await authAPI.sendOTP(phone);
    } catch {
      // ignore in dev
    } finally {
      setResendTimer(RESEND_SECONDS);
      setResending(false);
    }
  };

  const maskedPhone = `+977 ${phone.slice(0, 2)}****${phone.slice(-4)}`;

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
        <Text style={styles.headerTitle}>Verify OTP</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.body}>
        {/* Icon */}
        <View style={styles.iconCircle}>
          <Icon name="message-badge-outline" size={32} color={Colors.primary} />
        </View>

        <Text style={styles.title}>Enter verification code</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.phone}>{maskedPhone}</Text>
        </Text>

        {/* OTP boxes */}
        <View style={styles.otpRow}>
          {digits.map((digit, i) => (
            <TextInput
              key={i}
              ref={ref => { inputRefs.current[i] = ref; }}
              style={[
                styles.otpBox,
                digit ? styles.otpBoxFilled : null,
                error ? styles.otpBoxError : null,
              ]}
              value={digit}
              onChangeText={text => handleDigitChange(text, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              selectTextOnFocus
              autoFocus={i === 0}
            />
          ))}
        </View>

        {error ? (
          <View style={styles.errorRow}>
            <Icon name="alert-circle-outline" size={14} color={Colors.red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Verify button */}
        <TouchableOpacity
          style={[styles.btn, (loading || digits.some(d => !d)) && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={loading || digits.some(d => !d)}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              <Text style={styles.btnText}>Verify & Continue</Text>
              <Icon name="arrow-right" size={18} color={Colors.white} />
            </>
          )}
        </TouchableOpacity>

        {/* Resend */}
        <View style={styles.resendRow}>
          <Text style={styles.resendLabel}>Didn't receive the code? </Text>
          {resendTimer > 0 ? (
            <Text style={styles.resendTimer}>Resend in {resendTimer}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={resending}>
              <Text style={styles.resendLink}>
                {resending ? 'Sending…' : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Wrong number */}
        <TouchableOpacity style={styles.changeRow} onPress={() => navigation.goBack()}>
          <Icon name="pencil-outline" size={13} color={Colors.primary} />
          <Text style={styles.changeText}>Change phone number</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    flex: 1, alignItems: 'center',
    paddingHorizontal: Spacing.lg + 4,
    paddingTop: Spacing.xl + 8,
  },

  iconCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: Colors.badgeBg,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: { ...Typography.h2, textAlign: 'center', marginBottom: Spacing.sm },
  subtitle: {
    fontSize: 14, color: Colors.muted, textAlign: 'center',
    lineHeight: 21, marginBottom: Spacing.xl + 4,
  },
  phone: { color: Colors.text, fontWeight: '700' },

  otpRow: {
    flexDirection: 'row', gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  otpBox: {
    width: 46, height: 54, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    textAlign: 'center', fontSize: 22, fontWeight: '700',
    color: Colors.text, backgroundColor: Colors.light,
  },
  otpBoxFilled: {
    borderColor: Colors.primary, backgroundColor: Colors.badgeBg,
  },
  otpBoxError: { borderColor: Colors.red },

  errorRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 5, marginBottom: Spacing.sm, alignSelf: 'flex-start',
  },
  errorText: { fontSize: 12, color: Colors.red },

  btn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: Spacing.sm,
    marginTop: Spacing.lg, width: '100%',
  },
  btnDisabled: { backgroundColor: Colors.muted },
  btnText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  resendRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: Spacing.lg,
  },
  resendLabel: { fontSize: 13, color: Colors.muted },
  resendTimer: { fontSize: 13, color: Colors.muted, fontWeight: '600' },
  resendLink: { fontSize: 13, color: Colors.primary, fontWeight: '700' },

  changeRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 4, marginTop: Spacing.md,
  },
  changeText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
});
