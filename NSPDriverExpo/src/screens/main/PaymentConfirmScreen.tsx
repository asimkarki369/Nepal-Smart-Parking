import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { Colors, Spacing, BorderRadius, Typography } from '@/utils/theme';
import { sessionsAPI } from '@/services/api';
import { useStore } from '@/store/useStore';
import { mockZones } from '@/services/api';
import { RootStackParamList } from '@/navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'PaymentConfirm'>;
type ConfirmRoute = RouteProp<RootStackParamList, 'PaymentConfirm'>;

const PAYMENT_METHODS = [
  { id: 'esewa', label: 'eSewa', icon: 'cellphone', color: '#60BB46' },
  { id: 'khalti', label: 'Khalti', icon: 'cellphone-wireless', color: '#5C2D91' },
  { id: 'connectips', label: 'ConnectIPS', icon: 'bank-outline', color: '#E84142' },
] as const;

type PaymentMethodId = typeof PAYMENT_METHODS[number]['id'];

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function PaymentConfirmScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<ConfirmRoute>();
  const { zoneCode, vehicleType, durationMinutes } = route.params;
  const { user, setActiveSession } = useStore();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>('esewa');
  const [loading, setLoading] = useState(false);

  const zone = mockZones.find(z => z.code === zoneCode);
  const hourlyRate = vehicleType === '4w' ? (zone?.rate4w ?? 80) : (zone?.rate2w ?? 25);
  const parkingFee = Math.round((hourlyRate * durationMinutes) / 60);
  const serviceFee = Math.round(parkingFee * 0.1);
  const total = parkingFee + serviceFee;

  const handleConfirmPayment = async () => {
    setLoading(true);
    try {
      const res = await sessionsAPI.start({
        zoneCode,
        vehicleType,
        durationMinutes,
        paymentMethod: selectedMethod,
      });
      const session = res.data.session;
      setActiveSession({
        sessionId: session.sessionId,
        zoneCode,
        zoneName: zone?.name ?? zoneCode,
        zoneLocation: `${zone?.city ?? ''}, Nepal`,
        startTime: new Date(session.startTime),
        expiresAt: new Date(session.expiresAt),
        durationMinutes,
        fee: parkingFee,
        serviceFee,
        totalPaid: total,
        vehicleType,
        paymentMethod: selectedMethod,
        qrToken: session.qrToken,
      });
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch {
      // Dev fallback — create a local session
      const now = new Date();
      const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
      setActiveSession({
        sessionId: `dev_${Date.now()}`,
        zoneCode,
        zoneName: zone?.name ?? zoneCode,
        zoneLocation: `${zone?.city ?? ''}, Nepal`,
        startTime: now,
        expiresAt,
        durationMinutes,
        fee: parkingFee,
        serviceFee,
        totalPaid: total,
        vehicleType,
        paymentMethod: selectedMethod,
        qrToken: `QR-${zoneCode}-${Date.now()}`,
      });
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Payment</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

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
            <Text style={styles.detailValue}>{user?.plateNumber ?? '—'}</Text>
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

      {/* Pay button pinned to bottom */}
      <View style={styles.footer}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F6FA' },

  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Spacing.xxl + 8, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.white },

  body: { padding: Spacing.lg, paddingBottom: 100 },

  card: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.md + 4, marginBottom: Spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  cardHeaderText: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  zoneCode: { fontSize: 11, color: Colors.muted, fontWeight: '600' },

  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },

  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 5 },
  detailLabel: { flex: 1, fontSize: 13, color: Colors.muted },
  detailValue: { fontSize: 13, fontWeight: '600', color: Colors.text },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },

  costRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  costLabel: { flex: 1, fontSize: 13, color: Colors.muted },
  costValue: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  totalLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  totalValue: { fontSize: 17, fontWeight: '800', color: Colors.primary },

  sectionHeading: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },

  methodGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  methodCard: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingVertical: Spacing.md,
    alignItems: 'center', gap: 6,
    backgroundColor: Colors.white, position: 'relative',
  },
  methodCardActive: { borderColor: Colors.primary, backgroundColor: '#EEF2FB' },
  methodIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  methodLabel: { fontSize: 11, color: Colors.muted, fontWeight: '500' },
  methodLabelActive: { color: Colors.primary, fontWeight: '700' },
  methodCheck: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  secureRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5,
  },
  secureText: { fontSize: 12, color: Colors.muted },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.border,
    padding: Spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
  },
  footerTotal: { flex: 1 },
  footerTotalLabel: { fontSize: 11, color: Colors.muted },
  footerTotalValue: { fontSize: 20, fontWeight: '800', color: Colors.text },
  payBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  payBtnDisabled: { backgroundColor: Colors.muted },
  payBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
