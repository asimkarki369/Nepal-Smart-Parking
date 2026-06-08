import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ActivityIndicator, ScrollView, Modal,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing, BorderRadius } from '@/utils/theme';
import { sessionsAPI, mockZones } from '@/services/api';
import { useStore } from '@/store/useStore';
import { RootStackParamList } from '@/navigation/types';

type NavProp       = NativeStackNavigationProp<RootStackParamList, 'PaymentConfirm'>;
type ConfirmRoute  = RouteProp<RootStackParamList, 'PaymentConfirm'>;

const PAYMENT_METHODS = [
  { id: 'esewa',      label: 'eSewa',      icon: 'cellphone',          color: '#60BB46' },
  { id: 'khalti',     label: 'Khalti',     icon: 'cellphone-wireless', color: '#5C2D91' },
  { id: 'connectips', label: 'ConnectIPS', icon: 'bank-outline',       color: '#E84142' },
] as const;
type PaymentMethodId = typeof PAYMENT_METHODS[number]['id'];

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString('en-NP', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ── Receipt data captured after a successful payment ──────────────────────────
interface ReceiptData {
  sessionId:  string;
  qrToken:    string;
  paidAt:     Date;
}

export default function PaymentConfirmScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<ConfirmRoute>();
  const insets     = useSafeAreaInsets();

  const { zoneCode, vehicleType, durationMinutes, hourlyRate: routeRate, plateNumber } = route.params;
  const { user, setActiveSession } = useStore();
  const plate = plateNumber || '—';

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>('esewa');
  const [loading,        setLoading]        = useState(false);
  const [receipt,        setReceipt]        = useState<ReceiptData | null>(null);

  const zone = mockZones.find(z => z.code === zoneCode);

  // Rate from ZoneDetailScreen preserves EV/bus-specific values; fall back only if missing
  const hourlyRate = (typeof routeRate === 'number' && !isNaN(routeRate) && routeRate > 0)
    ? routeRate
    : (vehicleType === '4w' ? (zone?.rate4w ?? 80) : (zone?.rate2w ?? 25));

  const parkingFee = Math.round((hourlyRate * durationMinutes) / 60);
  const serviceFee = Math.round(parkingFee * 0.1);
  const total      = parkingFee + serviceFee;

  // ── Payment handler ─────────────────────────────────────────────────────────
  const handleConfirmPayment = async () => {
    setLoading(true);
    try {
      const res     = await sessionsAPI.start({ zoneCode, vehicleType, durationMinutes, paymentMethod: selectedMethod });
      const session = res.data.session;
      const startTime = new Date(session.startTime);
      const expiresAt = new Date(session.expiresAt);

      setActiveSession({
        sessionId: session.sessionId,
        zoneCode,
        zoneName:     zone?.name ?? zoneCode,
        zoneLocation: `${zone?.city ?? ''}, Nepal`,
        startTime, endTimeCap: expiresAt, expiresAt,
        durationMinutes, fee: parkingFee, serviceFee, totalPaid: total,
        vehicleType, plateNumber: plate, hourlyRate,
        paymentMethod: selectedMethod,
        qrToken: session.qrToken,
      });

      setReceipt({ sessionId: session.sessionId, qrToken: session.qrToken, paidAt: new Date() });
    } catch {
      // Dev fallback — local session
      const now       = new Date();
      const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
      const sessionId = `dev_${Date.now()}`;
      const qrToken   = `QR-${zoneCode}-${Date.now()}`;

      setActiveSession({
        sessionId,
        zoneCode,
        zoneName:     zone?.name ?? zoneCode,
        zoneLocation: `${zone?.city ?? ''}, Nepal`,
        startTime: now, endTimeCap: expiresAt, expiresAt,
        durationMinutes, fee: parkingFee, serviceFee, totalPaid: total,
        vehicleType, plateNumber: plate, hourlyRate,
        paymentMethod: selectedMethod,
        qrToken,
      });

      setReceipt({ sessionId, qrToken, paidAt: now });
    } finally {
      setLoading(false);
    }
  };

  // ── Layout helpers ──────────────────────────────────────────────────────────
  const FOOTER_H = Spacing.lg + 56 + Math.max(insets.bottom, Spacing.md);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Payment</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Body scroll ── */}
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: FOOTER_H + Spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Zone summary card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="map-marker" size={18} color={Colors.primary} />
            <Text style={styles.cardHeaderText}>{zone?.name ?? zoneCode}</Text>
            <Text style={styles.zoneCode}>{zoneCode}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Icon name={vehicleType === '4w' ? 'car' : 'motorbike'} size={16} color={Colors.muted} />
            <Text style={styles.detailLabel}>Vehicle</Text>
            <Text style={styles.detailValue}>{vehicleType === '4w' ? 'Car / SUV' : 'Motorcycle'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Icon name="account-outline" size={16} color={Colors.muted} />
            <Text style={styles.detailLabel}>Plate</Text>
            <Text style={styles.detailValue}>{plate}</Text>
          </View>
          <View style={styles.detailRow}>
            <Icon name="clock-outline" size={16} color={Colors.muted} />
            <Text style={styles.detailLabel}>Duration</Text>
            <Text style={styles.detailValue}>{formatDuration(durationMinutes)}</Text>
          </View>
        </View>

        {/* Cost breakdown */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Cost Breakdown</Text>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Parking fee ({formatDuration(durationMinutes)} × Rs {hourlyRate}/hr)</Text>
            <Text style={styles.costValue}>Rs {parkingFee}</Text>
          </View>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Service fee (10%)</Text>
            <Text style={styles.costValue}>Rs {serviceFee}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.costRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>Rs {total}</Text>
          </View>
        </View>

        {/* Payment method */}
        <Text style={styles.sectionHeading}>Payment Method</Text>
        <View style={styles.methodGrid}>
          {PAYMENT_METHODS.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[styles.methodCard, selectedMethod === m.id && styles.methodCardActive]}
              onPress={() => setSelectedMethod(m.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.methodIconCircle, { backgroundColor: m.color + '20' }]}>
                <Icon name={m.icon} size={22} color={m.color} />
              </View>
              <Text style={[styles.methodLabel, selectedMethod === m.id && styles.methodLabelActive]}>
                {m.label}
              </Text>
              {selectedMethod === m.id && (
                <View style={styles.methodCheck}>
                  <Icon name="check" size={10} color={Colors.white} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Security note */}
        <View style={styles.secureRow}>
          <Icon name="shield-check-outline" size={14} color={Colors.green} />
          <Text style={styles.secureText}>Payments are secured and encrypted.</Text>
        </View>
      </ScrollView>

      {/* ── Pinned pay button ── */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <View style={styles.footerTotal}>
          <Text style={styles.footerTotalLabel}>Total to pay</Text>
          <Text style={styles.footerTotalValue}>Rs {total}</Text>
        </View>
        <TouchableOpacity
          style={[styles.payBtn, loading && styles.payBtnDisabled]}
          onPress={handleConfirmPayment}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              <Icon name="lock-outline" size={16} color={Colors.white} />
              <Text style={styles.payBtnText}>Pay Rs {total}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ══════════════ RECEIPT MODAL ══════════════ */}
      <Modal
        visible={receipt !== null}
        animationType="slide"
        transparent
        onRequestClose={() => {/* block hardware back — force user to tap Done */}}
      >
        <View style={rcpt.overlay}>
          <View style={[rcpt.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>

            {/* Success badge */}
            <View style={rcpt.successBadge}>
              <View style={rcpt.successCircle}>
                <Icon name="check-bold" size={32} color={Colors.white} />
              </View>
              <Text style={rcpt.successTitle}>Payment Successful!</Text>
              <Text style={rcpt.successSub}>Your parking session has started.</Text>
            </View>

            {/* ── Paper receipt card ── */}
            <ScrollView
              style={rcpt.receiptScroll}
              contentContainerStyle={rcpt.receiptScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={rcpt.receiptCard}>

                {/* Letterhead */}
                <View style={rcpt.letterhead}>
                  <View style={rcpt.letterheadIcon}>
                    <Icon name="alpha-p-box" size={22} color={Colors.white} />
                  </View>
                  <View>
                    <Text style={rcpt.letterheadTitle}>Nepal Smart Parking</Text>
                    <Text style={rcpt.letterheadSub}>Official Parking Receipt</Text>
                  </View>
                </View>

                <View style={rcpt.dashedRule} />

                {/* Details */}
                {[
                  { label: 'Zone',     value: `${zone?.name ?? zoneCode}  (${zoneCode})` },
                  { label: 'Date',     value: receipt ? fmtDateTime(receipt.paidAt) : '—' },
                  { label: 'Duration', value: formatDuration(durationMinutes) },
                  { label: 'Vehicle',  value: vehicleType === '4w' ? 'Car / SUV' : 'Motorcycle' },
                  { label: 'Plate',    value: plate },
                  { label: 'Rate',     value: `Rs ${hourlyRate}/hr` },
                ].map(row => (
                  <View key={row.label} style={rcpt.row}>
                    <Text style={rcpt.rowLabel}>{row.label}</Text>
                    <Text style={rcpt.rowValue}>{row.value}</Text>
                  </View>
                ))}

                <View style={rcpt.dashedRule} />

                {/* Amounts */}
                <View style={rcpt.row}>
                  <Text style={rcpt.rowLabel}>Parking fee</Text>
                  <Text style={rcpt.rowValue}>Rs {parkingFee}</Text>
                </View>
                <View style={rcpt.row}>
                  <Text style={rcpt.rowLabel}>Service fee (10%)</Text>
                  <Text style={rcpt.rowValue}>Rs {serviceFee}</Text>
                </View>

                <View style={rcpt.totalRow}>
                  <Text style={rcpt.totalLabel}>TOTAL PAID</Text>
                  <Text style={rcpt.totalValue}>Rs {total}</Text>
                </View>

                <View style={rcpt.row}>
                  <Text style={rcpt.rowLabel}>Payment via</Text>
                  <Text style={rcpt.rowValue}>
                    {PAYMENT_METHODS.find(m => m.id === selectedMethod)?.label ?? selectedMethod}
                  </Text>
                </View>

                <View style={rcpt.dashedRule} />

                {/* Session / Receipt ID */}
                <View style={rcpt.row}>
                  <Text style={rcpt.rowLabel}>Receipt No.</Text>
                  <Text style={[rcpt.rowValue, rcpt.mono]} numberOfLines={1} ellipsizeMode="middle">
                    {receipt?.sessionId ?? '—'}
                  </Text>
                </View>
                <View style={rcpt.row}>
                  <Text style={rcpt.rowLabel}>Session QR</Text>
                  <Text style={[rcpt.rowValue, rcpt.mono]} numberOfLines={1} ellipsizeMode="middle">
                    {receipt?.qrToken ?? '—'}
                  </Text>
                </View>

                <View style={rcpt.dashedRule} />

                <Text style={rcpt.thankYou}>Thank you for using NSP!</Text>
                <Text style={rcpt.helpdesk}>helpdesk@nepalsmsartparking.com</Text>
              </View>
            </ScrollView>

            {/* ── Action button — receipt download only available after Stop & Pay ── */}
            <View style={rcpt.actions}>
              <TouchableOpacity
                style={rcpt.doneBtn}
                onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Main' }] })}
                activeOpacity={0.85}
              >
                <Icon name="parking" size={18} color={Colors.white} />
                <Text style={rcpt.doneBtnText}>Start Parking</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Confirm screen styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F6FA' },

  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.white },

  body: { padding: Spacing.lg },

  card: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.md + 4, marginBottom: Spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  cardHeaderText: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  zoneCode:       { fontSize: 11, color: Colors.muted, fontWeight: '600' },

  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },

  detailRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 5 },
  detailLabel: { flex: 1, fontSize: 13, color: Colors.muted },
  detailValue: { fontSize: 13, fontWeight: '600', color: Colors.text },

  sectionTitle:   { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  sectionHeading: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },

  costRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  costLabel:  { flex: 1, fontSize: 13, color: Colors.muted },
  costValue:  { fontSize: 13, color: Colors.text, fontWeight: '500' },
  totalLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  totalValue: { fontSize: 17, fontWeight: '800', color: Colors.primary },

  methodGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  methodCard: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingVertical: Spacing.md,
    alignItems: 'center', gap: 6,
    backgroundColor: Colors.white, position: 'relative',
  },
  methodCardActive:   { borderColor: Colors.primary, backgroundColor: '#EEF2FB' },
  methodIconCircle:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  methodLabel:        { fontSize: 11, color: Colors.muted, fontWeight: '500' },
  methodLabelActive:  { color: Colors.primary, fontWeight: '700' },
  methodCheck: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },

  secureRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  secureText: { fontSize: 12, color: Colors.muted },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingTop: Spacing.lg, paddingHorizontal: Spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
  },
  footerTotal:      { flex: 1 },
  footerTotalLabel: { fontSize: 11, color: Colors.muted },
  footerTotalValue: { fontSize: 20, fontWeight: '800', color: Colors.text },
  payBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2, paddingHorizontal: Spacing.xl,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  payBtnDisabled: { backgroundColor: Colors.muted },
  payBtnText:     { fontSize: 15, fontWeight: '700', color: Colors.white },
});

// ── Receipt modal styles ───────────────────────────────────────────────────────
const rcpt = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.light,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: Spacing.lg,
    maxHeight: '92%',
  },

  // ── Success badge ──
  successBadge: { alignItems: 'center', paddingBottom: Spacing.lg },
  successCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: Colors.green,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.green, shadowOpacity: 0.35, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  successTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  successSub:   { fontSize: 13, color: Colors.muted, marginTop: 4 },

  // ── Receipt card ──
  receiptScroll:        { flexShrink: 1 },
  receiptScrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  receiptCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },

  // Letterhead
  letterhead: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  letterheadIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  letterheadTitle: { fontSize: 15, fontWeight: '800', color: Colors.text },
  letterheadSub:   { fontSize: 11, color: Colors.muted, marginTop: 1 },

  // Dashed separator (paper receipt style)
  dashedRule: {
    borderStyle: 'dashed', borderWidth: 1, borderColor: Colors.border,
    marginVertical: Spacing.md,
  },

  // Detail rows
  row:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  rowLabel: { fontSize: 12, color: Colors.muted, flex: 1 },
  rowValue: { fontSize: 12, fontWeight: '600', color: Colors.text, flex: 2, textAlign: 'right' },
  mono:     { fontFamily: 'Courier', fontSize: 11 },

  // Total row
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm + 2,
    marginVertical: Spacing.sm,
  },
  totalLabel: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  totalValue: { fontSize: 18, fontWeight: '800', color: Colors.primary },

  // Footer text
  thankYou: { fontSize: 12, color: Colors.muted, textAlign: 'center', marginTop: Spacing.xs },
  helpdesk: { fontSize: 11, color: Colors.muted, textAlign: 'center', marginTop: 2 },

  // ── Action buttons ──
  actions: {
    flexDirection: 'row', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
  },
  shareBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderWidth: 1.5, borderColor: Colors.primary,
    borderRadius: BorderRadius.md, paddingVertical: Spacing.md + 2,
    backgroundColor: Colors.primaryLight,
  },
  shareBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primary },

  doneBtn: {
    flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md, paddingVertical: Spacing.md + 2,
  },
  doneBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },
});
