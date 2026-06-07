import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ActivityIndicator, Alert, ScrollView, Share, Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';

import { Colors, Spacing, BorderRadius, Typography } from '@/utils/theme';
import { sessionsAPI } from '@/services/api';
import { useStore } from '@/store/useStore';
import { RootStackParamList } from '@/navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ── helpers ───────────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function fmtDate(d: Date) {
  return d.toLocaleDateString('en-NP', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── circular ring ─────────────────────────────────────────────────────────────
const RING = 160; const CR = 65; const CSW = 9;
const CIRC = 2 * Math.PI * CR;
function polarXY(deg: number, r: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: RING / 2 + r * Math.cos(rad), y: RING / 2 + r * Math.sin(rad) };
}
function ringArc(pct: number) {
  const a = pct * 360;
  if (a >= 359.9) {
    const p1 = polarXY(0, CR); const p2 = polarXY(180, CR);
    return `M ${p1.x} ${p1.y} A ${CR} ${CR} 0 0 1 ${p2.x} ${p2.y} A ${CR} ${CR} 0 0 1 ${p1.x} ${p1.y}`;
  }
  const s = polarXY(0, a <= 0 ? 0.01 : 0, CR); // unused
  const start = polarXY(0, CR); const end = polarXY(a, CR);
  return `M ${start.x} ${start.y} A ${CR} ${CR} 0 ${a > 180 ? 1 : 0} 1 ${end.x} ${end.y}`;
}

// ── vehicle label ─────────────────────────────────────────────────────────────
function vehicleLabel(vt: string) {
  if (vt === 'bus') return 'Bus / Minibus';
  if (vt === 'ev')  return 'Electric Vehicle';
  if (vt === '4w')  return 'Car / Jeep';
  return 'Bike / Scooter';
}
function vehicleIcon(vt: string) {
  if (vt === 'bus') return 'bus';
  if (vt === 'ev')  return 'lightning-bolt';
  if (vt === '4w')  return 'car';
  return 'motorbike';
}

const PAYMENT_METHODS = [
  { id: 'esewa',      label: 'eSewa',      color: '#60BB46' },
  { id: 'khalti',     label: 'Khalti',     color: '#5C2D91' },
  { id: 'connectips', label: 'ConnectIPS', color: '#E84142' },
] as const;
type PMId = typeof PAYMENT_METHODS[number]['id'];

// ── component ─────────────────────────────────────────────────────────────────
export default function SessionScreen() {
  const navigation   = useNavigation<NavProp>();
  const insets       = useSafeAreaInsets();
  const { activeSession, setActiveSession, extendSession } = useStore();

  const [now,       setNow]       = useState(Date.now());
  const [extending, setExtending] = useState(false);
  const [stopping,  setStopping]  = useState(false);
  const [stopModal, setStopModal] = useState(false);
  const [payMethod, setPayMethod] = useState<PMId>('esewa');

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── empty state ───────────────────────────────────────────────────────────
  if (!activeSession) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
        <View style={styles.emptyIllustration}>
          <Icon name="clock-outline" size={52} color={Colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>No active session</Text>
        <Text style={styles.emptySub}>Start parking from the Home tab to see your live session here.</Text>

        {/* Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Quick tips</Text>
          {[
            { icon: 'alpha-b-box',     text: 'BLA zones are free — up to 2h' },
            { icon: 'lightning-bolt',  text: 'EV zones offer discounted rates' },
            { icon: 'clock-plus-outline', text: 'Extend your session any time before it ends' },
            { icon: 'qrcode-scan',     text: 'Show QR code to parking officers' },
          ].map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <View style={styles.tipIcon}>
                <Icon name={tip.icon as any} size={15} color={Colors.primary} />
              </View>
              <Text style={styles.tipText}>{tip.text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.findBtn} onPress={() => navigation.navigate('Main')}>
          <Icon name="map-search-outline" size={16} color={Colors.white} />
          <Text style={styles.findBtnText}>Find Parking</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── live maths ────────────────────────────────────────────────────────────
  const elapsed    = now - activeSession.startTime.getTime();
  const capMs      = activeSession.endTimeCap ? activeSession.endTimeCap.getTime() - now : null;
  const isFree     = activeSession.hourlyRate === 0;
  const isWarning  = capMs !== null && capMs > 0 && capMs < 10 * 60000;
  const isPastCap  = capMs !== null && capMs <= 0;
  const ringColor  = isPastCap ? Colors.red : isWarning ? Colors.orange : Colors.green;

  // Ring progress: fraction of cap used (cycles every 60min if open-ended)
  const ringPct = capMs !== null
    ? Math.min(1, elapsed / (elapsed + Math.max(0, capMs)))
    : (elapsed % (60 * 60000)) / (60 * 60000);

  // Live cost
  const liveMins  = Math.ceil(elapsed / 60000);
  const liveFee   = Math.round(activeSession.hourlyRate * liveMins / 60);
  const liveSvc   = Math.round(liveFee * 0.1);
  const liveTotal = liveFee + liveSvc;

  const handleExtend = async (mins: number) => {
    setExtending(true);
    try { await sessionsAPI.extend(activeSession.sessionId, mins); } catch { }
    extendSession(mins);
    setExtending(false);
  };

  const handleStop = async () => {
    setStopping(true);
    try { await sessionsAPI.stop(activeSession.sessionId); } catch { }
    setActiveSession(null);
    setStopModal(false);
    setStopping(false);
  };

  const handleShare = async () => {
    await Share.share({
      message: `NSP Parking Session\nZone: ${activeSession.zoneName} (${activeSession.zoneCode})\nID: ${activeSession.sessionId.slice(-8).toUpperCase()}\nStarted: ${fmtTime(activeSession.startTime)}`,
    });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} translucent />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Active Session</Text>
          <Text style={styles.headerSub}>{fmtDate(activeSession.startTime)}</Text>
        </View>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* ── Circular elapsed timer ── */}
        <View style={styles.timerCard}>
          <View style={styles.ringWrap}>
            <Svg width={RING} height={RING}>
              <Circle cx={RING/2} cy={RING/2} r={CR} stroke={Colors.borderLight} strokeWidth={CSW} fill="none" />
              {ringPct > 0 && (
                <Path d={ringArc(ringPct)} stroke={ringColor} strokeWidth={CSW} fill="none" strokeLinecap="round" />
              )}
              <Circle cx={polarXY(0, CR).x} cy={polarXY(0, CR).y} r={4} fill={ringColor} />
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={[styles.elapsedTime, { color: ringColor }]}>{fmtElapsed(elapsed)}</Text>
              <Text style={styles.elapsedLabel}>elapsed</Text>
            </View>
          </View>

          {/* Live cost */}
          {!isFree ? (
            <View style={styles.costRow}>
              <View style={styles.costItem}>
                <Text style={styles.costLabel}>Parking fee</Text>
                <Text style={styles.costValue}>Rs {liveFee}</Text>
              </View>
              <View style={styles.costDivider} />
              <View style={styles.costItem}>
                <Text style={styles.costLabel}>Service fee</Text>
                <Text style={styles.costValue}>Rs {liveSvc}</Text>
              </View>
              <View style={styles.costDivider} />
              <View style={styles.costItem}>
                <Text style={styles.costLabel}>Total</Text>
                <Text style={[styles.costValue, styles.costTotal]}>Rs {liveTotal}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.freeBadge}>
              <Icon name="alpha-b-box" size={16} color="#0055AA" />
              <Text style={styles.freeBadgeText}>BLA Zone · Free Parking</Text>
            </View>
          )}

          {/* Time info */}
          <View style={styles.timeInfoRow}>
            <Icon name="clock-start" size={12} color={Colors.muted} />
            <Text style={styles.timeInfoText}>Started {fmtTime(activeSession.startTime)}</Text>
            {activeSession.endTimeCap && (
              <>
                <Text style={styles.timeInfoDot}>·</Text>
                <Icon name="clock-end" size={12} color={Colors.muted} />
                <Text style={styles.timeInfoText}>Until {fmtTime(activeSession.endTimeCap)}</Text>
              </>
            )}
          </View>

          {/* Warnings */}
          {isWarning && !isPastCap && (
            <View style={[styles.warnBanner, { backgroundColor: Colors.orangeLight }]}>
              <Icon name="clock-alert-outline" size={14} color={Colors.orange} />
              <Text style={[styles.warnText, { color: Colors.orange }]}>Less than 10 min remaining</Text>
            </View>
          )}
          {isPastCap && (
            <View style={[styles.warnBanner, { backgroundColor: Colors.redLight }]}>
              <Icon name="alert-circle-outline" size={14} color={Colors.red} />
              <Text style={[styles.warnText, { color: Colors.red }]}>Past your planned end time</Text>
            </View>
          )}
        </View>

        {/* ── Session details ── */}
        <View style={styles.card}>
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}><Icon name="map-marker" size={16} color={Colors.primary} /></View>
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Zone</Text>
              <Text style={styles.detailValue}>{activeSession.zoneName}</Text>
              <Text style={styles.detailSub}>{activeSession.zoneCode} · {activeSession.zoneLocation}</Text>
            </View>
            <TouchableOpacity style={styles.navBtn} onPress={() => Alert.alert('Directions', 'Navigation to zone would open here.')}>
              <Icon name="navigation-variant-outline" size={16} color={Colors.primary} />
              <Text style={styles.navBtnText}>Directions</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Icon name={vehicleIcon(activeSession.vehicleType) as any} size={16} color={Colors.primary} />
            </View>
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Vehicle</Text>
              <Text style={styles.detailValue}>{vehicleLabel(activeSession.vehicleType)}</Text>
              {!isFree && <Text style={styles.detailSub}>Rs {activeSession.hourlyRate}/hr</Text>}
            </View>
            <View style={styles.payMethodBadge}>
              <Text style={styles.payMethodText}>{activeSession.paymentMethod.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* ── QR Code ── */}
        <View style={styles.qrCard}>
          <View style={styles.qrHeader}>
            <View>
              <Text style={styles.qrTitle}>Officer scan code</Text>
              <Text style={styles.qrSub}>Session #{activeSession.sessionId.slice(-8).toUpperCase()}</Text>
            </View>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Icon name="share-variant-outline" size={16} color={Colors.primary} />
              <Text style={styles.shareBtnText}>Share</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.qrBox}>
            <QRCode
              value={activeSession.qrToken}
              size={180}
              color={Colors.text}
              backgroundColor={Colors.white}
            />
          </View>
        </View>

        {/* ── Extend session ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Extend Session</Text>
          <View style={styles.extendGrid}>
            {[30, 60, 120, 180].map(mins => (
              <TouchableOpacity
                key={mins}
                style={styles.extendBtn}
                onPress={() => handleExtend(mins)}
                disabled={extending}
              >
                {extending ? <ActivityIndicator size="small" color={Colors.primary} /> : (
                  <>
                    <Text style={styles.extendMins}>+{mins < 60 ? `${mins}m` : `${mins / 60}h`}</Text>
                    {!isFree && (
                      <Text style={styles.extendCost}>Rs {Math.round(activeSession.hourlyRate * mins / 60 * 1.1)}</Text>
                    )}
                  </>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Stop & Pay ── */}
        <TouchableOpacity style={styles.stopBtn} onPress={() => setStopModal(true)}>
          <Icon name="stop-circle" size={20} color={Colors.white} />
          <Text style={styles.stopBtnText}>{isFree ? 'End Free Parking' : 'Stop & Pay'}</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ── Stop & Pay Modal ── */}
      <Modal visible={stopModal} transparent animationType="slide" onRequestClose={() => setStopModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{isFree ? 'End Free Parking' : 'Stop & Pay'}</Text>

            {/* Summary */}
            <View style={styles.summaryCard}>
              <SummaryRow label="Zone" value={activeSession.zoneName} />
              <SummaryRow label="Duration" value={fmtElapsed(elapsed)} />
              {!isFree && (
                <>
                  <SummaryRow label="Parking fee" value={`Rs ${liveFee}`} />
                  <SummaryRow label="Service fee (10%)" value={`Rs ${liveSvc}`} />
                  <View style={styles.summaryDivider} />
                  <SummaryRow label="Total" value={`Rs ${liveTotal}`} bold />
                </>
              )}
              {isFree && <SummaryRow label="Charge" value="Free — Rs 0" bold />}
            </View>

            {/* Payment method — only for paid zones */}
            {!isFree && (
              <>
                <Text style={styles.payLabel}>Pay with</Text>
                <View style={styles.payMethodRow}>
                  {PAYMENT_METHODS.map(m => (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.payChip, payMethod === m.id && { borderColor: m.color, backgroundColor: m.color + '15' }]}
                      onPress={() => setPayMethod(m.id)}
                    >
                      <Text style={[styles.payChipText, payMethod === m.id && { color: m.color, fontWeight: '700' }]}>{m.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.confirmBtn, stopping && { opacity: 0.6 }]}
              onPress={handleStop}
              disabled={stopping}
            >
              {stopping ? <ActivityIndicator color={Colors.white} /> : (
                <Text style={styles.confirmBtnText}>
                  {isFree ? 'End Parking' : `Pay Rs ${liveTotal} & Stop`}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setStopModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel — keep parking</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.summaryValueBold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },

  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.green },
  liveText: { fontSize: 11, fontWeight: '800', color: Colors.white, letterSpacing: 0.5 },

  body: { padding: Spacing.lg, paddingBottom: 40 },

  // Timer card
  timerCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md, alignItems: 'center',
    shadowColor: Colors.primary, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  ringWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  elapsedTime:  { fontSize: 26, fontWeight: '800', letterSpacing: 1 },
  elapsedLabel: { fontSize: 10, color: Colors.muted, fontWeight: '600', marginTop: 2 },

  costRow: {
    flexDirection: 'row', width: '100%',
    backgroundColor: Colors.light, borderRadius: BorderRadius.md,
    padding: Spacing.sm, marginBottom: Spacing.sm,
  },
  costItem:    { flex: 1, alignItems: 'center' },
  costDivider: { width: 1, backgroundColor: Colors.border },
  costLabel:   { fontSize: 10, color: Colors.muted, fontWeight: '600' },
  costValue:   { fontSize: 14, fontWeight: '700', color: Colors.text, marginTop: 2 },
  costTotal:   { color: Colors.primary, fontSize: 16 },

  freeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#E3F0FF', borderRadius: BorderRadius.sm,
    paddingHorizontal: 14, paddingVertical: 8, marginBottom: Spacing.sm,
  },
  freeBadgeText: { fontSize: 13, fontWeight: '700', color: '#0055AA' },

  timeInfoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4,
  },
  timeInfoText: { fontSize: 11, color: Colors.muted },
  timeInfoDot:  { fontSize: 11, color: Colors.muted },

  warnBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: BorderRadius.sm, padding: 8, marginTop: 4, width: '100%',
  },
  warnText: { fontSize: 12, flex: 1 },

  // Details card
  card: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.md + 2, marginBottom: Spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  detailRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: 4 },
  detailIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  detailText:  { flex: 1 },
  detailLabel: { fontSize: 10, color: Colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 14, fontWeight: '700', color: Colors.text, marginTop: 2 },
  detailSub:   { fontSize: 11, color: Colors.muted, marginTop: 1 },
  cardDivider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: Spacing.sm },

  navBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
  },
  navBtnText: { fontSize: 11, fontWeight: '700', color: Colors.primary },

  payMethodBadge: {
    backgroundColor: Colors.light, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, alignSelf: 'flex-start', marginTop: 4,
  },
  payMethodText: { fontSize: 11, fontWeight: '700', color: Colors.muted },

  // QR card
  qrCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  qrHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: Spacing.md },
  qrTitle:  { fontSize: 14, fontWeight: '700', color: Colors.text },
  qrSub:    { fontSize: 11, color: Colors.muted, marginTop: 2 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
  },
  shareBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  qrBox: {
    padding: Spacing.md + 4,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.white,
  },

  // Extend
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  extendGrid:   { flexDirection: 'row', gap: Spacing.sm },
  extendBtn: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.primary,
    borderRadius: BorderRadius.md, paddingVertical: Spacing.sm + 2,
    alignItems: 'center', gap: 2,
  },
  extendMins: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  extendCost: { fontSize: 10, color: Colors.muted },

  stopBtn: {
    backgroundColor: Colors.red, borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md + 2,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
  },
  stopBtnText: { fontSize: 15, fontWeight: '800', color: Colors.white },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg, paddingTop: 8,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 16 },

  summaryCard: {
    backgroundColor: Colors.light, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: 14,
  },
  summaryRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  summaryDivider:   { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  summaryLabel:     { fontSize: 13, color: Colors.muted },
  summaryValue:     { fontSize: 13, fontWeight: '600', color: Colors.text },
  summaryValueBold: { fontSize: 16, fontWeight: '800', color: Colors.primary },

  payLabel:    { fontSize: 12, fontWeight: '700', color: Colors.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  payMethodRow:{ flexDirection: 'row', gap: 8, marginBottom: 14 },
  payChip: {
    flex: 1, paddingVertical: 9, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.light,
  },
  payChipText: { fontSize: 12, color: Colors.muted, fontWeight: '600' },

  confirmBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
    paddingVertical: 14, alignItems: 'center', marginBottom: 4,
  },
  confirmBtnText: { fontSize: 15, fontWeight: '800', color: Colors.white },

  cancelBtn:     { alignItems: 'center', paddingVertical: 14 },
  cancelBtnText: { fontSize: 14, color: Colors.muted, fontWeight: '600' },

  // Empty state
  empty: { flex: 1, backgroundColor: Colors.white, paddingHorizontal: Spacing.xl, alignItems: 'center', justifyContent: 'center' },
  emptyIllustration: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg,
  },
  emptyTitle: { ...Typography.h2, marginBottom: Spacing.sm, textAlign: 'center' },
  emptySub:   { fontSize: 14, color: Colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },

  tipsCard: {
    width: '100%', backgroundColor: Colors.light,
    borderRadius: BorderRadius.lg, padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  tipsTitle: { fontSize: 12, fontWeight: '800', color: Colors.muted, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  tipRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  tipIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  tipText: { fontSize: 13, color: Colors.textSecondary, flex: 1 },

  findBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  findBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },
});
