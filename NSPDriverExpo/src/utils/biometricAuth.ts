import * as LocalAuth from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── AsyncStorage keys ─────────────────────────────────────────────────────────
const DRIVER_BIO_ENABLED  = 'nsp_bio_enabled';
const DRIVER_BIO_ID       = 'nsp_bio_nationalId';
const DRIVER_BIO_PASS     = 'nsp_bio_password';

const OFFICER_BIO_ENABLED = 'nsp_officer_bio_enabled';
const OFFICER_BIO_ID      = 'nsp_officer_bio_officerId';
const OFFICER_BIO_PASS    = 'nsp_officer_bio_password';

// ── Hardware check ────────────────────────────────────────────────────────────

/**
 * Returns true if the device has biometric hardware AND an enrolled biometric.
 * Returns false (never throws) if the native module isn't available yet —
 * this happens before the first `expo run:android` build after install.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const hasHW    = await LocalAuth.hasHardwareAsync();
    const enrolled = await LocalAuth.isEnrolledAsync();
    return hasHW && enrolled;
  } catch {
    return false; // native module not compiled in yet — needs rebuild
  }
}

/**
 * Returns a human-readable label based on what the device supports.
 * e.g. "Fingerprint", "Face ID", or "Biometric"
 */
export async function getBiometricLabel(): Promise<string> {
  try {
    const types = await LocalAuth.supportedAuthenticationTypesAsync();
    const hasFace        = types.includes(LocalAuth.AuthenticationType.FACIAL_RECOGNITION);
    const hasFingerprint = types.includes(LocalAuth.AuthenticationType.FINGERPRINT);
    if (hasFace && hasFingerprint) return 'Biometric';
    if (hasFace)        return 'Face ID';
    if (hasFingerprint) return 'Fingerprint';
  } catch { /* ignore */ }
  return 'Biometric';
}

/** Returns the appropriate icon name for MaterialCommunityIcons. */
export async function getBiometricIcon(): Promise<string> {
  try {
    const types = await LocalAuth.supportedAuthenticationTypesAsync();
    const hasFace = types.includes(LocalAuth.AuthenticationType.FACIAL_RECOGNITION);
    return hasFace ? 'face-recognition' : 'fingerprint';
  } catch { /* ignore */ }
  return 'fingerprint';
}

/** Trigger the system biometric prompt. Returns true on success. */
export async function authenticateBiometric(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuth.authenticateAsync({
      promptMessage,
      disableDeviceFallback: false,
      cancelLabel: 'Use Password',
    });
    return result.success;
  } catch {
    return false;
  }
}

// ── Driver biometric credentials ──────────────────────────────────────────────

export async function isDriverBiometricEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(DRIVER_BIO_ENABLED)) === 'true';
}

export async function saveDriverBiometric(nationalId: string, password: string) {
  await AsyncStorage.multiSet([
    [DRIVER_BIO_ENABLED, 'true'],
    [DRIVER_BIO_ID,      nationalId],
    [DRIVER_BIO_PASS,    password],
  ]);
}

export async function getDriverBiometricCredentials(): Promise<{ nationalId: string; password: string } | null> {
  const pairs = await AsyncStorage.multiGet([DRIVER_BIO_ID, DRIVER_BIO_PASS]);
  const id    = pairs[0][1];
  const pass  = pairs[1][1];
  if (!id || !pass) return null;
  return { nationalId: id, password: pass };
}

export async function clearDriverBiometric() {
  await AsyncStorage.multiRemove([DRIVER_BIO_ENABLED, DRIVER_BIO_ID, DRIVER_BIO_PASS]);
}

// ── Officer biometric credentials ─────────────────────────────────────────────

export async function isOfficerBiometricEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(OFFICER_BIO_ENABLED)) === 'true';
}

export async function saveOfficerBiometric(officerId: string, password: string) {
  await AsyncStorage.multiSet([
    [OFFICER_BIO_ENABLED, 'true'],
    [OFFICER_BIO_ID,      officerId],
    [OFFICER_BIO_PASS,    password],
  ]);
}

export async function getOfficerBiometricCredentials(): Promise<{ officerId: string; password: string } | null> {
  const pairs = await AsyncStorage.multiGet([OFFICER_BIO_ID, OFFICER_BIO_PASS]);
  const id    = pairs[0][1];
  const pass  = pairs[1][1];
  if (!id || !pass) return null;
  return { officerId: id, password: pass };
}

export async function clearOfficerBiometric() {
  await AsyncStorage.multiRemove([OFFICER_BIO_ENABLED, OFFICER_BIO_ID, OFFICER_BIO_PASS]);
}
