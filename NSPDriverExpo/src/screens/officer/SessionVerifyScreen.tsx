import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ScrollView, ActivityIndicator, Image, Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { Colors, Spacing, BorderRadius } from '@/utils/theme';
import { RootStackParamList } from '@/navigation/types';
import { useStore } from '@/store/useStore';
import { calcFine, getBracketLabel, FINE_BRACKETS } from '@/utils/fineCalc';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteP  = RouteProp<RootStackParamList, 'SessionVerify'>;

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function vehicleLabel(vt: string) {
  if (vt === 'bus') return 'Bus / Minibus';
  if (vt === 'ev')  return 'Electric Vehicle';
  if (vt === '4w')  return 'Car / Jeep';
  return 'Bike / Scooter';
}

interface PhotoEvidence {
  vehicleFront: string | null;
  vehicleBack:  string | null;
  vehicleRight: string | null;
  vehicleLeft:  string | null;
  plateFront:   string | null;
  plateBack:    string | null;
  timeCard:     string | null;
}

const PHOTO_SLOTS: { key: keyof PhotoEvidence; label: string; icon: string; hint: string }[] = [
  { key: 'vehicleFront', label: 'Vehicle — Front',     icon: 'car',                 hint: 'Full front view of the vehicle'       },
  { key: 'vehicleBack',  label: 'Vehicle — Back',      icon: 'car-back',            hint: 'Full rear view of the vehicle'        },
  { key: 'vehicleRight', label: 'Vehicle — Right Side',icon: 'car-side',            hint: 'Right side of the vehicle'            },
  { key: 'vehicleLeft',  label: 'Vehicle — Left Side', icon: 'car-side',            hint: 'Left side of the vehicle'             },
  { key: 'plateFront',   label: 'Number Plate — Front',icon: 'card-text-outline',   hint: 'Close-up of front number plate'       },
  { key: 'plateBack',    label: 'Number Plate — Back', icon: 'card-text',           hint: 'Close-up of rear number plate'        },
  { key: 'timeCard',     label: 'Time Card / Meter',   icon: 'clock-outline',       hint: 'Parking meter or time card at vehicle'},
];

export default function SessionVerifyScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RouteP>();
  const insets     = useSafeAreaInsets();
  const { officer, addFine } = useStore();

  const { sessionToken, overtimeMins, fineAmount } = route.params;
  const { sessionRegistry } = useStore();

  // Look up from live registry by plate number or sessionId
  const session = sessionRegistry[sessionToken.toUpperCase()]
    ?? Object.values(sessionRegistry).find(s => s.sessionId === sessionToken);

  const [photos,   setPhotos]   = useState<PhotoEvidence>({
    vehicleFront: null, vehicleBack: null, vehicleRight: null, vehicleLeft: null,
    plateFront: null, plateBack: null, timeCard: null,
  });
  const [issuing,  setIssuing]  = useState(false);
  const [issued,   setIssued]   = useState(false);
  const [step,     setStep]     = useState<'details' | 'evidence' | 'confirm'>('details');

  const isViolation   = overtimeMins > 0 || !session;
  const capturedCount = Object.values(photos).filter(Boolean).length;
  const totalSlots    = PHOTO_SLOTS.length;
  const allPhotos     = capturedCount === totalSlots;
  const bracket       = getBracketLabel(overtimeMins);

  const takePhoto = async (slot: keyof PhotoEvidence) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      // Fallback to gallery
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
      });
      if (!res.canceled && res.assets[0]) {
        setPhotos(p => ({ ...p, [slot]: res.assets[0].uri }));
      }
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]) {
      setPhotos(p => ({ ...p, [slot]: res.assets[0].uri }));
    }
  };

  const handleIssueFine = async () => {
    if (!allPhotos) { Alert.alert('Evidence Required', `All ${totalSlots} photos must be captured before issuing a fine.`); return; }
    setIssuing(true);
    await new Promise(r => setTimeout(r, 900));
    addFine({
      fineId:       `FINE-${Date.now()}`,
      sessionToken: sessionToken,
      plateNumber:  session?.plate ?? sessionToken,
      zoneName:     session?.zoneName ?? 'Unknown Zone',
      overtimeMins,
      fineAmount,
      issuedAt:     new Date(),
      officerId:    officer?.id ?? '',
      paid:         false,
    });
    setIssuing(false);
    setIssued(true);
  };

  // ── ISSUED CONFIRMATION ────────────────────────────────────────────────────
  if (issued) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={[styles.header, { backgroundColor: Colors.green }]}>
          <TouchableOpacity onPress={() => { navigation.navigate('OfficerMain'); }} style={styles.backBtn}>
            <Icon name="arrow-left" size={22} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Fine Issued</Text>
        </View>
        <View style={styles.issuedWrap}>
          <View style={styles.issuedIcon}>
            <Icon name="check-circle" size={56} color={Colors.green} />
          </View>
          <Text style={styles.issuedTitle}>Fine Successfully Issued</Text>
          <Text style={styles.issuedSub}>
            Rs {fineAmount} fine recorded for{'\n'}
            <Text style={{ fontWeight: '800' }}>{session?.plate ?? sessionToken}</Text>
          </Text>

          <View style={styles.issuedSummary}>
            <SummaryRow label="Overtime"   value={`${overtimeMins} minutes`} />
            <SummaryRow label="Fine"       value={`Rs ${fineAmount}`} bold />
            <SummaryRow label="Officer"    value={officer?.id ?? ''} />
            <SummaryRow label="Time"       value={fmtTime(new Date())} />
            <SummaryRow label="Evidence"   value="7 photos captured ✓" />
          </View>

          <Text style={styles.issuedNotice}>
            Driver has been notified. Fine must be paid within 7 days to avoid penalty escalation.
          </Text>

          <TouchableOpacity style={styles.doneBtn}
            onPress={() => { navigation.navigate('OfficerMain'); }}>
            <Text style={styles.doneBtnText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#E65100" translucent />

      <View style={[styles.header, isViolation ? { backgroundColor: '#E65100' } : { backgroundColor: Colors.green }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 'details'  ? 'Session Details' :
           step === 'evidence' ? 'Collect Evidence' : 'Confirm Fine'}
        </Text>
        <View style={styles.stepIndicator}>
          {['details','evidence','confirm'].map((s, i) => (
            <View key={s} style={[styles.stepDot, step === s && styles.stepDotActive]} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* ── STEP 1: Session details ─────────────────────────────────────── */}
        {step === 'details' && (
          <>
            {/* Status banner */}
            <View style={[styles.statusBanner,
              isViolation ? styles.bannerViolation : styles.bannerValid]}>
              <Icon
                name={isViolation ? 'alert-circle-outline' : 'check-circle-outline'}
                size={24}
                color={isViolation ? Colors.red : Colors.green}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.bannerTitle,
                  { color: isViolation ? Colors.red : Colors.green }]}>
                  {!session
                    ? 'No Session Found — Illegal Parking'
                    : isViolation
                    ? `Overtime by ${overtimeMins} minutes`
                    : 'Valid Session'}
                </Text>
                {session && (
                  <Text style={styles.bannerSub}>{bracket.label} · Rs {fineAmount} fine applies</Text>
                )}
              </View>
            </View>

            {/* Session details card */}
            {session ? (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>DRIVER & SESSION DETAILS</Text>
                <DetailRow icon="account"          label="Driver"    value={session.driverName} />
                <DetailRow icon="phone-outline"    label="Phone"     value={session.phone} />
                <DetailRow icon="card-text"        label="Plate"     value={session.plateNumber} mono />
                <DetailRow icon="car-outline"      label="Vehicle"   value={vehicleLabel(session.vehicleType)} />
                <DetailRow icon="map-marker"       label="Zone"      value={`${session.zoneName} (${session.zoneCode})`} />
                <DetailRow icon="clock-start"      label="Started"   value={fmtTime(session.startTime)} />
                {session.endTimeCap && (
                  <DetailRow icon="clock-end"      label="End Time"  value={fmtTime(session.endTimeCap)} highlight={isViolation} />
                )}
                {isViolation && (
                  <DetailRow icon="clock-alert"    label="Overtime"  value={`${overtimeMins} min`} highlight />
                )}
              </View>
            ) : (
              <View style={[styles.card, { borderColor: Colors.red, borderWidth: 1.5 }]}>
                <Text style={styles.cardLabel}>VIOLATION</Text>
                <Text style={styles.noSessionText}>
                  No valid parking session registered for this vehicle.{'\n'}
                  Vehicle is parked without payment or authorization.
                </Text>
              </View>
            )}

            {/* Fine bracket */}
            {isViolation && (
              <View style={styles.fineCard}>
                <Text style={styles.cardLabel}>FINE SCHEDULE</Text>
                {FINE_BRACKETS.slice(1).map((b, i) => (
                  <View key={i} style={[styles.bracketRow, b.amount === fineAmount && styles.bracketActive]}>
                    <Icon name={b.amount === fineAmount ? 'chevron-right' : 'minus'} size={12}
                      color={b.amount === fineAmount ? '#E65100' : Colors.muted} />
                    <Text style={[styles.bracketLabel, b.amount === fineAmount && { color: '#E65100', fontWeight: '700' }]}>
                      {b.overtimeLabel}
                    </Text>
                    <Text style={[styles.bracketAmount, b.amount === fineAmount && { color: '#E65100', fontWeight: '800' }]}>
                      Rs {b.amount}
                    </Text>
                  </View>
                ))}
                <View style={styles.fineTotalRow}>
                  <Text style={styles.fineTotalLabel}>Applicable Fine</Text>
                  <Text style={styles.fineTotalValue}>Rs {fineAmount}</Text>
                </View>
              </View>
            )}

            {isViolation ? (
              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep('evidence')}>
                <Icon name="camera" size={18} color={Colors.white} />
                <Text style={styles.nextBtnText}>Next: Collect Evidence Photos</Text>
                <Icon name="arrow-right" size={16} color={Colors.white} />
              </TouchableOpacity>
            ) : (
              <View style={styles.validActions}>
                <Icon name="check-circle-outline" size={18} color={Colors.green} />
                <Text style={styles.validText}>Session is valid. No action required.</Text>
              </View>
            )}
          </>
        )}

        {/* ── STEP 2: Evidence photos ─────────────────────────────────────── */}
        {step === 'evidence' && (
          <>
            <View style={styles.evidenceNotice}>
              <Icon name="camera-alert" size={20} color="#E65100" />
              <Text style={styles.evidenceNoticeText}>
                All 7 photos are mandatory before a fine can be issued. This protects officers from disputes.
              </Text>
            </View>

            {PHOTO_SLOTS.map(slot => {
              const uri = photos[slot.key];
              return (
                <View key={slot.key} style={[styles.photoSlot, uri && styles.photoSlotDone]}>
                  <View style={styles.photoSlotHeader}>
                    <View style={[styles.photoSlotIcon, uri && { backgroundColor: Colors.greenLight }]}>
                      <Icon name={slot.icon as any} size={20} color={uri ? Colors.green : '#E65100'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.photoSlotLabel}>{slot.label}</Text>
                      <Text style={styles.photoSlotHint}>{slot.hint}</Text>
                    </View>
                    {uri && <Icon name="check-circle" size={20} color={Colors.green} />}
                  </View>

                  {uri ? (
                    <View style={styles.photoPreviewWrap}>
                      <Image source={{ uri }} style={styles.photoPreview} />
                      <TouchableOpacity style={styles.retakeBtn} onPress={() => takePhoto(slot.key)}>
                        <Icon name="camera-retake-outline" size={14} color={Colors.primary} />
                        <Text style={styles.retakeBtnText}>Retake</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.captureBtn} onPress={() => takePhoto(slot.key)}>
                      <Icon name="camera-plus-outline" size={20} color={Colors.white} />
                      <Text style={styles.captureBtnText}>Take Photo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            <View style={styles.photoProgress}>
              <Text style={styles.photoProgressText}>
                {capturedCount} of {totalSlots} photos captured
              </Text>
              <View style={styles.photoProgressBar}>
                <View style={[styles.photoProgressFill, {
                  width: `${(capturedCount / totalSlots) * 100}%` as any,
                }]} />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.nextBtn, !allPhotos && styles.nextBtnDisabled]}
              onPress={() => allPhotos && setStep('confirm')}
              disabled={!allPhotos}
            >
              <Icon name="clipboard-check-outline" size={18} color={Colors.white} />
              <Text style={styles.nextBtnText}>Next: Confirm & Issue Fine</Text>
              <Icon name="arrow-right" size={16} color={Colors.white} />
            </TouchableOpacity>
          </>
        )}

        {/* ── STEP 3: Confirm ─────────────────────────────────────────────── */}
        {step === 'confirm' && (
          <>
            <View style={styles.confirmCard}>
              <Text style={styles.cardLabel}>FINE SUMMARY</Text>
              <SummaryRow label="Vehicle plate" value={session?.plate ?? sessionToken} bold />
              <SummaryRow label="Driver"        value={session?.driverName ?? 'Unknown'} />
              <SummaryRow label="Zone"          value={session?.zoneName ?? 'Unknown'} />
              <SummaryRow label="Overtime"      value={`${overtimeMins} minutes`} />
              <SummaryRow label="Fine type"     value={bracket.label} />
              <View style={styles.confirmTotalRow}>
                <Text style={styles.confirmTotalLabel}>Total Fine</Text>
                <Text style={styles.confirmTotalValue}>Rs {fineAmount}</Text>
              </View>
            </View>

            {/* Photo thumbnails */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>EVIDENCE PHOTOS ({capturedCount}/{totalSlots})</Text>
              <View style={styles.thumbGrid}>
                {PHOTO_SLOTS.map(slot => (
                  <View key={slot.key} style={styles.thumbWrap}>
                    <Image source={{ uri: photos[slot.key]! }} style={styles.thumb} />
                    <Text style={styles.thumbLabel} numberOfLines={2}>{slot.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.issueBtn, issuing && { opacity: 0.6 }]}
              onPress={handleIssueFine}
              disabled={issuing}
            >
              {issuing
                ? <ActivityIndicator color={Colors.white} />
                : <>
                    <Icon name="gavel" size={20} color={Colors.white} />
                    <Text style={styles.issueBtnText}>Issue Fine — Rs {fineAmount}</Text>
                  </>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.backStepBtn} onPress={() => setStep('evidence')}>
              <Icon name="arrow-left" size={14} color={Colors.muted} />
              <Text style={styles.backStepBtnText}>Back to photos</Text>
            </TouchableOpacity>
          </>
        )}

      </ScrollView>
    </View>
  );
}

function DetailRow({ icon, label, value, mono, highlight }: {
  icon: string; label: string; value: string; mono?: boolean; highlight?: boolean;
}) {
  return (
    <View style={drStyles.row}>
      <Icon name={icon as any} size={14} color={highlight ? Colors.red : Colors.primary} />
      <Text style={drStyles.label}>{label}</Text>
      <Text style={[drStyles.value, mono && drStyles.mono, highlight && drStyles.highlight]}>{value}</Text>
    </View>
  );
}
const drStyles = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  label:     { width: 68, fontSize: 11, color: Colors.muted, fontWeight: '600' },
  value:     { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.text },
  mono:      { letterSpacing: 1, fontFamily: 'monospace' },
  highlight: { color: Colors.red, fontWeight: '800' },
});

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={srStyles.row}>
      <Text style={srStyles.label}>{label}</Text>
      <Text style={[srStyles.value, bold && srStyles.bold]}>{value}</Text>
    </View>
  );
}
const srStyles = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  label: { fontSize: 12, color: Colors.muted },
  value: { fontSize: 13, fontWeight: '600', color: Colors.text },
  bold:  { fontSize: 14, fontWeight: '800', color: Colors.text },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },

  header: {
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, paddingTop: Spacing.sm,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.white },
  stepIndicator: { flexDirection: 'row', gap: 5 },
  stepDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  stepDotActive: { backgroundColor: Colors.white },

  body: { padding: Spacing.lg, paddingBottom: 40 },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: BorderRadius.lg, padding: Spacing.md + 4,
    marginBottom: Spacing.md, borderWidth: 1,
  },
  bannerValid:     { backgroundColor: Colors.greenLight, borderColor: Colors.green },
  bannerViolation: { backgroundColor: Colors.redLight,   borderColor: Colors.red },
  bannerTitle:     { fontSize: 14, fontWeight: '800' },
  bannerSub:       { fontSize: 12, color: Colors.muted, marginTop: 2 },

  card: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.md + 4, marginBottom: Spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  cardLabel: { fontSize: 10, fontWeight: '800', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: Spacing.sm },

  noSessionText: { fontSize: 13, color: Colors.muted, lineHeight: 20 },

  fineCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.md + 4, marginBottom: Spacing.md,
    borderWidth: 2, borderColor: '#E65100',
    shadowColor: '#E65100', shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  bracketRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingHorizontal: 4, borderRadius: 6 },
  bracketActive:{ backgroundColor: '#FFF3E0' },
  bracketLabel: { flex: 1, fontSize: 12, color: Colors.muted },
  bracketAmount:{ fontSize: 12, color: Colors.muted, fontWeight: '600' },
  fineTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: Colors.border,
    marginTop: Spacing.sm, paddingTop: Spacing.sm,
  },
  fineTotalLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  fineTotalValue: { fontSize: 20, fontWeight: '800', color: '#E65100' },

  nextBtn: {
    backgroundColor: '#E65100', borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md + 2,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  nextBtnDisabled: { backgroundColor: Colors.muted },
  nextBtnText:     { fontSize: 14, fontWeight: '800', color: Colors.white, flex: 1, textAlign: 'center' },

  validActions: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.greenLight, borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  validText: { fontSize: 13, color: Colors.green, fontWeight: '600', flex: 1 },

  // Evidence step
  evidenceNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFF3E0', borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: '#FFB74D',
  },
  evidenceNoticeText: { flex: 1, fontSize: 12, color: '#E65100', lineHeight: 18 },

  photoSlot: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.md + 2, marginBottom: Spacing.md,
    borderWidth: 2, borderColor: Colors.border,
    shadowColor: '#000', shadowOpacity: 0.03, elevation: 1,
  },
  photoSlotDone:   { borderColor: Colors.green },
  photoSlotHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.sm },
  photoSlotIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#FFF3E0', alignItems: 'center', justifyContent: 'center',
  },
  photoSlotLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  photoSlotHint:  { fontSize: 11, color: Colors.muted, marginTop: 2 },

  photoPreviewWrap: { gap: Spacing.sm },
  photoPreview: {
    width: '100%', height: 160, borderRadius: BorderRadius.md,
    backgroundColor: Colors.light,
  },
  retakeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end',
    backgroundColor: Colors.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
  },
  retakeBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  captureBtn: {
    backgroundColor: '#E65100', borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
  },
  captureBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },

  photoProgress:    { marginBottom: Spacing.md },
  photoProgressText:{ fontSize: 12, fontWeight: '600', color: Colors.muted, marginBottom: 6 },
  photoProgressBar: { height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  photoProgressFill:{ height: '100%', backgroundColor: '#E65100', borderRadius: 3 },

  // Confirm step
  confirmCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.md + 4, marginBottom: Spacing.md,
    borderWidth: 2, borderColor: '#E65100',
    shadowColor: '#E65100', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  confirmTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1.5, borderTopColor: Colors.border,
    marginTop: Spacing.sm, paddingTop: Spacing.md,
  },
  confirmTotalLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  confirmTotalValue: { fontSize: 24, fontWeight: '800', color: '#E65100' },

  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  thumbWrap: { width: '30%', alignItems: 'center', gap: 4 },
  thumb:     { width: '100%', aspectRatio: 1, borderRadius: BorderRadius.md, backgroundColor: Colors.light },
  thumbLabel:{ fontSize: 9, color: Colors.muted, textAlign: 'center', lineHeight: 13 },

  issueBtn: {
    backgroundColor: '#E65100', borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md + 4,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  issueBtnText: { fontSize: 16, fontWeight: '800', color: Colors.white },

  backStepBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: Spacing.sm,
  },
  backStepBtnText: { fontSize: 13, color: Colors.muted },

  // Issued confirmation
  issuedWrap: {
    flex: 1, padding: Spacing.xl, alignItems: 'center',
  },
  issuedIcon: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: Colors.greenLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg,
  },
  issuedTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm },
  issuedSub:   { fontSize: 14, color: Colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.lg },
  issuedSummary: {
    width: '100%', backgroundColor: Colors.light,
    borderRadius: BorderRadius.lg, padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  issuedNotice: {
    fontSize: 12, color: Colors.muted, textAlign: 'center',
    lineHeight: 18, marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  doneBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl,
  },
  doneBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },
});
