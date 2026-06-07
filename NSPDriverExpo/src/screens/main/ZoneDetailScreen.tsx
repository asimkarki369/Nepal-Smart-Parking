import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { Colors, Spacing, BorderRadius } from '@/utils/theme';
import { mockZones } from '@/services/api';
import { useStore } from '@/store/useStore';
import { RootStackParamList } from '@/navigation/types';
import ClockTimePicker from '@/components/ClockTimePicker';

type NavProp     = NativeStackNavigationProp<RootStackParamList>;
type RoutePropType = RouteProp<RootStackParamList, 'ZoneDetail'>;

function fmtEndTime(mins: number | null): string {
  if (!mins) return '--:--';
  const end = new Date(Date.now() + mins * 60000);
  return end.toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function pad2(n: number) { return String(n).padStart(2, '0'); }

export default function ZoneDetailScreen() {
  const navigation   = useNavigation<NavProp>();
  const route        = useRoute<RoutePropType>();
  const { user }     = useStore();
  const zone         = mockZones.find(z => z.code === route.params.zoneCode) ?? mockZones[0];

  const vehicleType  = user?.vehicleType ?? '4w';
  const rate         = vehicleType === '4w' ? zone.rate4w
                     : vehicleType === '2w' ? zone.rate2w
                     : vehicleType === 'ev' ? (zone.rateEv ?? zone.rate4w)
                     : (zone.rateBus ?? zone.rate4w);

  const maxMins      = zone.type === 'free' ? (zone.freeTimeLimitMins ?? undefined) : undefined;
  const [selectedMins, setSelectedMins] = useState<number | null>(null);

  const isFull       = zone.occupancyPercent >= 95;
  const canContinue  = !isFull && selectedMins != null;

  // Zone badge display  e.g. "Z-KMC-01" → show short code
  const zoneShort = zone.code.replace('Z-', '').replace('-', ' ');

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Icon name="close" size={22} color={Colors.text} />
        </TouchableOpacity>

        {/* Zone badge — EasyPark style blue P */}
        <View style={styles.zoneBadge}>
          <View style={styles.pBox}>
            <Text style={styles.pText}>P</Text>
          </View>
          <Text style={styles.zoneCode}>{zoneShort}</Text>
        </View>

        <TouchableOpacity style={styles.iconBtn}>
          <Icon name="information-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Heading ── */}
      <View style={styles.headingBlock}>
        <Text style={styles.headingBig}>Spin</Text>
        <Text style={styles.headingSub}>to set time</Text>

        {/* Ends time pill */}
        <View style={styles.endsPill}>
          <Icon name="clock-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.endsText}>
            Ends {fmtEndTime(selectedMins)}
          </Text>
        </View>
      </View>

      {/* ── Clock picker ── */}
      <View style={styles.pickerWrap}>
        <ClockTimePicker
          selectedMins={selectedMins}
          onSelect={setSelectedMins}
          hourlyRate={rate}
          maxMins={maxMins}
        />
      </View>

      {/* ── Continue button ── */}
      <View style={styles.footer}>
        {isFull && (
          <Text style={styles.fullWarning}>⚠️  This zone is currently full</Text>
        )}
        <TouchableOpacity
          style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
          disabled={!canContinue}
          onPress={() =>
            navigation.navigate('PaymentConfirm', {
              zoneCode: zone.code,
              vehicleType,
              durationMinutes: selectedMins!,
            })
          }
        >
          <Text style={[styles.continueBtnText, !canContinue && styles.continueBtnTextDisabled]}>
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },

  /* top bar */
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },

  /* zone badge */
  zoneBadge:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pBox: {
    width: 26, height: 26, borderRadius: 4,
    backgroundColor: Colors.zoneBadge,
    alignItems: 'center', justifyContent: 'center',
  },
  pText:      { fontSize: 13, fontWeight: '900', color: Colors.white },
  zoneCode:   { fontSize: 16, fontWeight: '700', color: Colors.zoneBadge },

  /* heading */
  headingBlock: { alignItems: 'center', paddingTop: Spacing.xl, paddingBottom: Spacing.md },
  headingBig:   { fontSize: 52, fontWeight: '800', color: Colors.text, lineHeight: 58 },
  headingSub:   { fontSize: 20, color: Colors.muted, marginBottom: Spacing.md },
  endsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.light, borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.lg, paddingVertical: 8,
  },
  endsText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },

  /* picker */
  pickerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },

  /* footer */
  footer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, paddingTop: Spacing.sm },
  fullWarning: { fontSize: 13, color: Colors.red, textAlign: 'center', marginBottom: Spacing.sm },
  continueBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2, alignItems: 'center',
  },
  continueBtnDisabled: { backgroundColor: Colors.border },
  continueBtnText:     { fontSize: 16, fontWeight: '700', color: Colors.white },
  continueBtnTextDisabled: { color: Colors.muted },
});
