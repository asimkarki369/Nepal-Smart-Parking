import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

import { Colors, Spacing, BorderRadius } from '@/utils/theme';
import { mockZones } from '@/services/api';
import { RootStackParamList } from '@/navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RoutePropType = RouteProp<RootStackParamList, 'ZoneDetail'>;

const DURATION_OPTIONS = [
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '3 hours', value: 180 },
  { label: '4 hours', value: 240 },
];

export default function ZoneDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const zone = mockZones.find((z) => z.code === route.params.zoneCode) ?? mockZones[0];

  const [vehicleType, setVehicleType] = useState<'2w' | '4w'>('4w');
  const [durationMinutes, setDurationMinutes] = useState(60);

  const rate = vehicleType === '4w' ? zone.rate4w : zone.rate2w;
  const fee = Math.round(rate * (durationMinutes / 60));
  const serviceFee = Math.round(fee * 0.10);
  const total = fee + serviceFee;
  const isFull = zone.occupancyPercent >= 95;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Zone Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.zoneHeaderRow}>
            <View>
              <Text style={styles.zoneName}>{zone.name}</Text>
              <Text style={styles.zoneCode}>{zone.code} · {zone.city}</Text>
            </View>
            <View style={[
              styles.tag,
              isFull ? styles.tagRed : zone.occupancyPercent >= 70 ? styles.tagAmber : styles.tagGreen,
            ]}>
              <Text style={[
                styles.tagText,
                isFull ? { color: Colors.red } : zone.occupancyPercent >= 70 ? { color: Colors.accent } : { color: Colors.green },
              ]}>
                {isFull ? 'Full' : `${zone.availableSpots} spots free`}
              </Text>
            </View>
          </View>

          <View style={styles.ratesRow}>
            <View style={styles.ratebox}>
              <Text style={styles.rateNum}>Rs {zone.rate4w}</Text>
              <Text style={styles.rateLbl}>Per hour (4W)</Text>
            </View>
            <View style={styles.ratebox}>
              <Text style={styles.rateNum}>Rs {zone.rate2w}</Text>
              <Text style={styles.rateLbl}>Per hour (2W)</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.fieldLabel}>Vehicle Type</Text>
          <View style={styles.toggleRow}>
            {(['4w', '2w'] as const).map((vt) => (
              <TouchableOpacity
                key={vt}
                style={[styles.toggleBtn, vehicleType === vt && styles.toggleActive]}
                onPress={() => setVehicleType(vt)}
              >
                <Icon
                  name={vt === '4w' ? 'car' : 'motorbike'}
                  size={18}
                  color={vehicleType === vt ? Colors.white : Colors.muted}
                />
                <Text style={[styles.toggleText, vehicleType === vt && { color: Colors.white }]}>
                  {vt === '4w' ? 'Car / Jeep' : 'Bike / Scooter'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Duration</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={durationMinutes}
              onValueChange={setDurationMinutes}
              style={{ color: Colors.text }}
            >
              {DURATION_OPTIONS.map((o) => (
                <Picker.Item key={o.value} label={o.label} value={o.value} />
              ))}
            </Picker>
          </View>

          <View style={styles.divider} />

          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Parking fee</Text>
            <Text style={styles.costValue}>Rs {fee}</Text>
          </View>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Service fee (10%)</Text>
            <Text style={styles.costValue}>Rs {serviceFee}</Text>
          </View>
          <View style={[styles.costRow, { marginTop: Spacing.sm }]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>Rs {total}</Text>
          </View>

          <TouchableOpacity
            style={[styles.btnPrimary, isFull && { backgroundColor: Colors.muted }]}
            onPress={() => {
              if (isFull) {
                Alert.alert('Zone Full', 'This zone is currently full. Please choose another zone.');
                return;
              }
              navigation.navigate('PaymentConfirm', { zoneCode: zone.code, vehicleType, durationMinutes });
            }}
          >
            <Icon name="credit-card-outline" size={18} color={Colors.white} />
            <Text style={styles.btnPrimaryText}>Proceed to Payment</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl, paddingBottom: Spacing.md,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.white },
  card: {
    backgroundColor: Colors.white, margin: Spacing.md,
    borderRadius: BorderRadius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  zoneHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  zoneName: { fontSize: 18, fontWeight: '700', color: Colors.text },
  zoneCode: { fontSize: 13, fontWeight: '700', color: Colors.primary, fontFamily: 'Courier', marginTop: 4 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.pill },
  tagGreen: { backgroundColor: Colors.tagGreenBg },
  tagRed: { backgroundColor: Colors.tagRedBg },
  tagAmber: { backgroundColor: Colors.tagAmberBg },
  tagText: { fontSize: 12, fontWeight: '700' },
  ratesRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  ratebox: {
    flex: 1, backgroundColor: Colors.light, borderRadius: BorderRadius.md,
    padding: Spacing.md, alignItems: 'center',
  },
  rateNum: { fontSize: 18, fontWeight: '700', color: Colors.text },
  rateLbl: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.muted, marginBottom: Spacing.sm },
  toggleRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  toggleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleText: { fontSize: 13, fontWeight: '600', color: Colors.muted },
  pickerContainer: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.md,
    marginBottom: Spacing.md, overflow: 'hidden',
  },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  costLabel: { fontSize: 13, color: Colors.muted },
  costValue: { fontSize: 13, fontWeight: '600', color: Colors.text },
  totalLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  totalValue: { fontSize: 20, fontWeight: '700', color: Colors.primary },
  btnPrimary: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, marginTop: Spacing.md,
  },
  btnPrimaryText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
