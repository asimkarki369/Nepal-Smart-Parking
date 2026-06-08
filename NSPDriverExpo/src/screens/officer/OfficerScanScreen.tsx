import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Image, Modal, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { Colors, Spacing, BorderRadius } from '@/utils/theme';
import { RootStackParamList } from '@/navigation/types';
import { calcFine } from '@/utils/fineCalc';
import { useStore, RegistryEntry } from '@/store/useStore';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function OfficerScanScreen() {
  const navigation  = useNavigation<NavProp>();
  const insets      = useSafeAreaInsets();
  const inputRef    = useRef<TextInput>(null);

  const { sessionRegistry } = useStore();

  const [plate,       setPlate]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [platePhoto,  setPlatePhoto]  = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result,      setResult]      = useState<RegistryEntry & {
    overtimeMins: number; fineAmount: number; status: 'valid' | 'violation' | 'no_session';
  } | null>(null);

  // ── Open camera to photograph number plate ──────────────────────────────
  const handleScanPlate = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission',
        'Camera access is required to scan number plates. Please enable it in Settings.',
      );
      return;
    }

    const res = await ImagePicker.launchCameraAsync({
      quality:        0.8,
      allowsEditing:  false,
      aspect:         [16, 9],
    });

    if (!res.canceled && res.assets[0]) {
      setPlatePhoto(res.assets[0].uri);
      setShowConfirm(true);   // show confirm modal
      setResult(null);
      setError('');
    }
  };

  // ── Confirm plate from photo ─────────────────────────────────────────────
  const handleConfirmPhoto = () => {
    setShowConfirm(false);
    // Focus input so officer can type/correct the plate
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  // ── Retake photo ─────────────────────────────────────────────────────────
  const handleRetake = () => {
    setShowConfirm(false);
    setPlatePhoto(null);
    handleScanPlate();
  };

  // ── Check plate against session DB ───────────────────────────────────────
  const handleCheck = async () => {
    const p = plate.trim().toUpperCase().replace(/\s+/g, ' ');
    if (!p || p.length < 4) { setError('Enter a valid plate number.'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    await new Promise(r => setTimeout(r, 700));

    // Look up in live session registry (connected to driver store)
    const session = sessionRegistry[p];
    if (!session) {
      // No check-in found — illegal parking
      setResult({
        sessionId: '', plateNumber: p, driverName: 'Unknown',
        phone: '—', vehicleType: '4w', zoneCode: '—', zoneName: '—',
        startTime: new Date(), endTimeCap: null, hourlyRate: 0,
        paymentMethod: '—', qrToken: '',
        overtimeMins: 0, fineAmount: calcFine(999), status: 'no_session',
      });
      setLoading(false);
      return;
    }

    const now          = Date.now();
    const overtimeMins = session.endTimeCap
      ? Math.max(0, Math.floor((now - session.endTimeCap.getTime()) / 60000))
      : 0;
    const fineAmount   = calcFine(overtimeMins);
    const status       = overtimeMins > 15 ? 'violation' : 'valid';

    setResult({ ...session, overtimeMins, fineAmount, status });
    setLoading(false);
  };

  const handleIssueFine = () => {
    if (!result) return;
    navigation.navigate('SessionVerify', {
      sessionToken: result.plateNumberNumber,
      overtimeMins: result.overtimeMins,
      fineAmount:   result.fineAmount,
    });
  };

  const clearAll = () => {
    setPlate('');
    setPlatePhoto(null);
    setResult(null);
    setError('');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="#E65100" translucent />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Check Plate</Text>
        <Text style={styles.headerSub}>Scan or type the vehicle number plate</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

        {/* ── Scan button ── */}
        <TouchableOpacity style={styles.scanBtn} onPress={handleScanPlate} activeOpacity={0.85}>
          <View style={styles.scanBtnIcon}>
            <Icon name="camera" size={32} color="#E65100" />
          </View>
          <View style={styles.scanBtnText}>
            <Text style={styles.scanBtnTitle}>Scan Number Plate</Text>
            <Text style={styles.scanBtnSub}>Point camera at the vehicle's plate</Text>
          </View>
          <Icon name="chevron-right" size={20} color={Colors.muted} />
        </TouchableOpacity>

        {/* Plate photo preview (after scan) */}
        {platePhoto && (
          <View style={styles.photoPreviewCard}>
            <View style={styles.photoPreviewHeader}>
              <Icon name="image-check-outline" size={16} color={Colors.green} />
              <Text style={styles.photoPreviewLabel}>Plate photo captured</Text>
              <TouchableOpacity onPress={handleScanPlate} style={styles.retakeBtn}>
                <Icon name="camera-retake-outline" size={14} color={Colors.primary} />
                <Text style={styles.retakeBtnText}>Retake</Text>
              </TouchableOpacity>
            </View>
            <Image source={{ uri: platePhoto }} style={styles.platePhotoImg} />
            <Text style={styles.platePhotoHint}>
              Type the plate number you see above ↓
            </Text>
          </View>
        )}

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>
            {platePhoto ? 'CONFIRM PLATE' : 'OR ENTER MANUALLY'}
          </Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Plate input */}
        <View style={[styles.plateInputWrap, error ? styles.plateInputError : null]}>
          <View style={styles.plateFlag}>
            <Text style={styles.plateFlagText}>🇳🇵</Text>
          </View>
          <TextInput
            ref={inputRef}
            style={styles.plateInput}
            placeholder="e.g. BA 1 KHA 1234"
            placeholderTextColor={Colors.muted}
            value={plate}
            onChangeText={t => { setPlate(t); setError(''); setResult(null); }}
            autoCapitalize="characters"
            returnKeyType="search"
            onSubmitEditing={handleCheck}
          />
          {plate.length > 0 && (
            <TouchableOpacity onPress={clearAll} style={{ padding: 10 }}>
              <Icon name="close-circle" size={18} color={Colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        {error ? (
          <View style={styles.errorRow}>
            <Icon name="alert-circle-outline" size={14} color={Colors.red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Check button */}
        <TouchableOpacity
          style={[styles.checkBtn, (!plate.trim() || loading) && styles.checkBtnDisabled]}
          onPress={handleCheck}
          disabled={!plate.trim() || loading}
        >
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <>
                <Icon name="magnify" size={18} color={Colors.white} />
                <Text style={styles.checkBtnText}>Check Plate</Text>
              </>
          }
        </TouchableOpacity>

        {/* ── Result card ── */}
        {result && (
          <View style={[
            styles.resultCard,
            result.status === 'valid'      && styles.resultValid,
            result.status === 'violation'  && styles.resultViolation,
            result.status === 'no_session' && styles.resultNoSession,
          ]}>
            {/* Status header */}
            <View style={styles.resultBanner}>
              <Icon
                name={
                  result.status === 'valid'     ? 'check-circle'  :
                  result.status === 'violation' ? 'alert-circle'  :
                                                  'close-circle'
                }
                size={30}
                color={
                  result.status === 'valid'     ? Colors.green :
                  result.status === 'violation' ? Colors.red   :
                                                  Colors.muted
                }
              />
              <View style={{ flex: 1 }}>
                <Text style={[
                  styles.resultStatus,
                  result.status === 'valid'     && { color: Colors.green },
                  result.status === 'violation' && { color: Colors.red },
                ]}>
                  {result.status === 'valid'      ? '✓  VALID SESSION'     :
                   result.status === 'violation'  ? '✕  PARKING VIOLATION' :
                                                    '—  NO SESSION FOUND'  }
                </Text>
                <Text style={styles.resultPlate}>{result.plateNumber}</Text>
              </View>
            </View>

            {result.status !== 'no_session' && (
              <>
                <View style={styles.resultDivider} />
                <ResultRow icon="account-outline"   label="Driver"   value={result.driverName} />
                <ResultRow icon="phone-outline"     label="Phone"    value={result.phone} />
                <ResultRow icon="car-outline"       label="Vehicle"  value={`${vehicleLabel(result.vehicleType)} · ${result.plateNumber}`} />
                <ResultRow icon="map-marker"        label="Zone"     value={`${result.zoneName} (${result.zoneCode})`} />
                <ResultRow icon="clock-start"       label="Started"  value={fmtTime(result.startTime)} />
                {result.endTimeCap && (
                  <ResultRow
                    icon="clock-end"
                    label="End time"
                    value={fmtTime(result.endTimeCap)}
                    highlight={result.status === 'violation'}
                  />
                )}
                {result.status === 'violation' && (
                  <ResultRow icon="clock-alert" label="Overtime" value={`${result.overtimeMins} min`} highlight />
                )}
              </>
            )}

            {result.status === 'no_session' && (
              <Text style={styles.noSessionText}>
                No active parking session found for this plate. Vehicle may be parked illegally.
              </Text>
            )}

            {result.status === 'valid' && (
              <View style={styles.validBanner}>
                <Icon name="check-circle-outline" size={16} color={Colors.green} />
                <Text style={styles.validText}>No action required — session is valid</Text>
              </View>
            )}

            {(result.status === 'violation' || result.status === 'no_session') && (
              <TouchableOpacity style={styles.issueBtn} onPress={handleIssueFine}>
                <Icon name="camera" size={16} color={Colors.white} />
                <Text style={styles.issueBtnText}>
                  Collect Evidence & Issue Fine
                  {result.fineAmount > 0 ? `  (Rs ${result.fineAmount})` : ''}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Demo plates */}
        <View style={styles.demoCard}>
          <Text style={styles.demoTitle}>Demo plates (dev only)</Text>
          {[
            { plate: 'BA 1 KHA 1234', hint: 'Valid session',      color: Colors.green },
            { plate: 'GA 1 JA 9012',  hint: 'Overtime violation', color: Colors.red   },
            { plate: 'BA 3 NA 3456',  hint: 'No session',         color: Colors.muted },
          ].map(d => (
            <TouchableOpacity key={d.plate} style={styles.demoRow}
              onPress={() => { setPlate(d.plate); setResult(null); setError(''); }}>
              <View style={[styles.demoDot, { backgroundColor: d.color }]} />
              <Text style={styles.demoPlate}>{d.plate}</Text>
              <Text style={styles.demoHint}>{d.hint}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>

      {/* ── Photo confirm modal ── */}
      <Modal
        visible={showConfirm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConfirm(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setShowConfirm(false)}
          />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Confirm Number Plate</Text>
            <Text style={styles.modalSub}>Check the photo is clear, then type the plate number below</Text>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {platePhoto && (
                <Image source={{ uri: platePhoto }} style={styles.modalPhoto} />
              )}

              <View style={styles.modalInputWrap}>
                <View style={styles.plateFlag}>
                  <Text style={styles.plateFlagText}>🇳🇵</Text>
                </View>
                <TextInput
                  style={styles.plateInput}
                  placeholder="Type plate number from photo"
                  placeholderTextColor={Colors.muted}
                  value={plate}
                  onChangeText={t => setPlate(t.toUpperCase())}
                  autoCapitalize="characters"
                  autoFocus
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalRetakeBtn} onPress={handleRetake}>
                  <Icon name="camera-retake-outline" size={16} color="#E65100" />
                  <Text style={styles.modalRetakeBtnText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, !plate.trim() && { opacity: 0.5 }]}
                  onPress={handleConfirmPhoto}
                  disabled={!plate.trim()}
                >
                  <Icon name="check" size={16} color={Colors.white} />
                  <Text style={styles.modalConfirmBtnText}>Confirm Plate</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────
function ResultRow({ icon, label, value, highlight }: {
  icon: string; label: string; value: string; highlight?: boolean;
}) {
  return (
    <View style={rrStyles.row}>
      <Icon name={icon as any} size={13} color={highlight ? Colors.red : Colors.primary} />
      <Text style={rrStyles.label}>{label}</Text>
      <Text style={[rrStyles.value, highlight && rrStyles.hi]}>{value}</Text>
    </View>
  );
}
const rrStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 4 },
  label: { width: 65, fontSize: 11, color: Colors.muted, fontWeight: '600' },
  value: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.text },
  hi:    { color: Colors.red, fontWeight: '800' },
});

function vehicleLabel(vt: string) {
  if (vt === 'bus') return 'Bus / Minibus';
  if (vt === 'ev')  return 'Electric Vehicle';
  if (vt === '4w')  return 'Car / Jeep';
  return 'Bike / Scooter';
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ── styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },

  header: {
    backgroundColor: '#E65100', paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl, paddingTop: Spacing.sm,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 3 },

  body: { padding: Spacing.lg, paddingBottom: 40 },

  // Scan button
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md + 2,
    marginBottom: Spacing.md,
    borderWidth: 2, borderColor: '#E65100',
    shadowColor: '#E65100', shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  scanBtnIcon: {
    width: 56, height: 56, borderRadius: 14,
    backgroundColor: '#FFF3E0',
    alignItems: 'center', justifyContent: 'center',
  },
  scanBtnText:  { flex: 1 },
  scanBtnTitle: { fontSize: 15, fontWeight: '800', color: Colors.text },
  scanBtnSub:   { fontSize: 12, color: Colors.muted, marginTop: 2 },

  // Photo preview
  photoPreviewCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.green,
    gap: Spacing.sm,
  },
  photoPreviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  photoPreviewLabel:  { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.green },
  retakeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  retakeBtnText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  platePhotoImg: {
    width: '100%', height: 130, borderRadius: BorderRadius.md,
    backgroundColor: Colors.light,
  },
  platePhotoHint: { fontSize: 11, color: Colors.muted, textAlign: 'center' },

  dividerRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.md },
  dividerLine:  { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerLabel: { fontSize: 10, fontWeight: '700', color: Colors.muted, letterSpacing: 0.5 },

  // Plate input
  plateInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 2, borderColor: '#E65100',
    borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, overflow: 'hidden',
  },
  plateInputError: { borderColor: Colors.red },
  plateFlag: {
    paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: '#FFF3E0',
    borderRightWidth: 1, borderRightColor: '#FFB74D',
  },
  plateFlagText: { fontSize: 18 },
  plateInput: {
    flex: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: 18, fontWeight: '800', color: Colors.text, letterSpacing: 2,
  },

  errorRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: Spacing.sm },
  errorText: { fontSize: 12, color: Colors.red, flex: 1 },

  checkBtn: {
    backgroundColor: '#E65100', borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md + 2,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  checkBtnDisabled: { backgroundColor: Colors.muted },
  checkBtnText:     { fontSize: 15, fontWeight: '800', color: Colors.white },

  // Result
  resultCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.md + 4, marginBottom: Spacing.lg,
    borderWidth: 2, borderColor: Colors.border,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  resultValid:     { borderColor: Colors.green },
  resultViolation: { borderColor: Colors.red },
  resultNoSession: { borderColor: Colors.muted },
  resultBanner:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.sm },
  resultStatus:    { fontSize: 13, fontWeight: '800', color: Colors.text },
  resultPlate:     { fontSize: 20, fontWeight: '800', color: Colors.text, letterSpacing: 2, marginTop: 2 },
  resultDivider:   { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },

  noSessionText: { fontSize: 13, color: Colors.muted, lineHeight: 20, marginTop: Spacing.sm },

  validBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.greenLight, borderRadius: BorderRadius.sm,
    padding: Spacing.sm + 2, marginTop: Spacing.sm,
  },
  validText: { fontSize: 13, color: Colors.green, fontWeight: '600', flex: 1 },

  issueBtn: {
    backgroundColor: '#E65100', borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  issueBtnText: { fontSize: 13, fontWeight: '800', color: Colors.white },

  // Demo
  demoCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.md,
    padding: Spacing.md, gap: 8, borderWidth: 1, borderColor: Colors.border,
  },
  demoTitle: { fontSize: 10, fontWeight: '700', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  demoRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  demoDot:   { width: 8, height: 8, borderRadius: 4 },
  demoPlate: { fontSize: 13, fontWeight: '700', color: Colors.primary, flex: 1, letterSpacing: 0.5 },
  demoHint:  { fontSize: 11, color: Colors.muted },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg, paddingTop: 8,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 14,
  },
  modalTitle:  { fontSize: 17, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  modalSub:    { fontSize: 12, color: Colors.muted, marginBottom: Spacing.md },
  modalPhoto:  {
    width: '100%', height: 160, borderRadius: BorderRadius.lg,
    backgroundColor: Colors.light, marginBottom: Spacing.md,
  },
  modalInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.light,
    borderWidth: 2, borderColor: '#E65100',
    borderRadius: BorderRadius.lg, marginBottom: Spacing.md, overflow: 'hidden',
  },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  modalRetakeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#E65100', borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
  modalRetakeBtnText:   { fontSize: 14, fontWeight: '700', color: '#E65100' },
  modalConfirmBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#E65100', borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
  modalConfirmBtnText: { fontSize: 14, fontWeight: '800', color: Colors.white },
});
