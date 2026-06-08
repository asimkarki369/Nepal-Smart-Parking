import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ScrollView, Alert,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing, BorderRadius } from '@/utils/theme';
import { useStore } from '@/store/useStore';
import { mockZones } from '@/services/api';

// Mock active sessions in officer's zone
const MOCK_SESSIONS = [
  { id: 'SES_001', plate: 'BA 1 KHA 1234', vehicle: '4w', startedAt: new Date(Date.now() - 75 * 60000), endTimeCap: new Date(Date.now() - 15 * 60000), zone: 'Z-KMC-01', status: 'overtime' },
  { id: 'SES_002', plate: 'BA 2 CHA 5678', vehicle: '2w', startedAt: new Date(Date.now() - 40 * 60000), endTimeCap: new Date(Date.now() + 20 * 60000), zone: 'Z-KMC-01', status: 'active' },
  { id: 'SES_003', plate: 'GA 1 JA 9012',  vehicle: '4w', startedAt: new Date(Date.now() - 130 * 60000), endTimeCap: new Date(Date.now() - 70 * 60000), zone: 'Z-KMC-01', status: 'overtime' },
  { id: 'SES_004', plate: 'BA 3 NA 3456',  vehicle: 'ev', startedAt: new Date(Date.now() - 20 * 60000), endTimeCap: null, zone: 'Z-KMC-01', status: 'active' },
];

function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtDuration(ms: number) {
  const s = Math.floor(Math.abs(ms) / 1000);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export default function OfficerDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { officer, issuedFines, officerLogout } = useStore();

  const zone = mockZones.find(z => z.code === officer?.zone);
  const overtimeSessions = MOCK_SESSIONS.filter(s => s.status === 'overtime');
  const activeSessions   = MOCK_SESSIONS.filter(s => s.status === 'active');
  const todayFines       = issuedFines.filter(f => f.officerId === officer?.id);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#E65100" translucent />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good day, Officer</Text>
          <Text style={styles.officerName}>{officer?.name}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.badgePill}>
            <Icon name="shield-star" size={12} color="#E65100" />
            <Text style={styles.badgeText}>{officer?.badgeNumber}</Text>
          </View>
          <TouchableOpacity onPress={() => Alert.alert('Logout', 'Sign out as officer?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', onPress: officerLogout },
          ])}>
            <Icon name="logout" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* Zone info */}
        <View style={styles.zoneCard}>
          <View style={styles.zoneCardLeft}>
            <Text style={styles.zoneCardLabel}>Assigned Zone</Text>
            <Text style={styles.zoneCardName}>{zone?.name ?? officer?.zone}</Text>
            <Text style={styles.zoneCardCode}>{officer?.zone} · {zone?.city}</Text>
          </View>
          <View style={styles.zoneStats}>
            <View style={styles.zoneStat}>
              <Text style={styles.zoneStatNum}>{zone?.totalSpots ?? 0}</Text>
              <Text style={styles.zoneStatLabel}>Total</Text>
            </View>
            <View style={styles.zoneStat}>
              <Text style={[styles.zoneStatNum, { color: Colors.green }]}>{zone?.availableSpots ?? 0}</Text>
              <Text style={styles.zoneStatLabel}>Free</Text>
            </View>
            <View style={styles.zoneStat}>
              <Text style={[styles.zoneStatNum, { color: Colors.red }]}>{overtimeSessions.length}</Text>
              <Text style={styles.zoneStatLabel}>Overtime</Text>
            </View>
          </View>
        </View>

        {/* Summary row */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: Colors.red }]}>
            <Text style={styles.summaryNum}>{overtimeSessions.length}</Text>
            <Text style={styles.summaryLabel}>Overtime</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: Colors.green }]}>
            <Text style={styles.summaryNum}>{activeSessions.length}</Text>
            <Text style={styles.summaryLabel}>Active</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#E65100' }]}>
            <Text style={styles.summaryNum}>{todayFines.length}</Text>
            <Text style={styles.summaryLabel}>Fines Today</Text>
          </View>
        </View>

        {/* Overtime alerts */}
        {overtimeSessions.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Icon name="alert-circle" size={16} color={Colors.red} />
              <Text style={styles.sectionTitle}>Overtime Vehicles</Text>
            </View>
            {overtimeSessions.map(s => {
              const over = s.endTimeCap ? Date.now() - s.endTimeCap.getTime() : 0;
              return (
                <View key={s.id} style={[styles.sessionCard, styles.sessionCardOvertime]}>
                  <View style={styles.sessionLeft}>
                    <View style={styles.plateWrap}>
                      <Text style={styles.plateNum}>{s.plate}</Text>
                    </View>
                    <Text style={styles.sessionMeta}>
                      <Icon name={s.vehicle === '4w' ? 'car' : s.vehicle === 'ev' ? 'lightning-bolt' : 'motorbike'} size={12} color={Colors.muted} />
                      {' '}Overtime: {fmtDuration(over)}
                    </Text>
                  </View>
                  <View style={styles.overtimeBadge}>
                    <Text style={styles.overtimeBadgeText}>OVERTIME</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Active sessions */}
        <View style={styles.sectionHeader}>
          <Icon name="clock-check-outline" size={16} color={Colors.green} />
          <Text style={styles.sectionTitle}>Active Sessions</Text>
        </View>
        {activeSessions.map(s => (
          <View key={s.id} style={styles.sessionCard}>
            <View style={styles.sessionLeft}>
              <View style={styles.plateWrap}>
                <Text style={styles.plateNum}>{s.plate}</Text>
              </View>
              <Text style={styles.sessionMeta}>
                Parked {fmtDuration(Date.now() - s.startedAt.getTime())} ago
                {s.endTimeCap ? ` · until ${s.endTimeCap.toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit' })}` : ' · open'}
              </Text>
            </View>
            <View style={styles.activeBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.activeBadgeText}>VALID</Text>
            </View>
          </View>
        ))}

        {/* Recent fines */}
        {todayFines.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Icon name="receipt" size={16} color="#E65100" />
              <Text style={styles.sectionTitle}>Fines Issued Today</Text>
            </View>
            {todayFines.map(f => (
              <View key={f.fineId} style={[styles.sessionCard, { borderLeftColor: '#E65100' }]}>
                <View style={styles.sessionLeft}>
                  <Text style={styles.plateNum}>{f.plateNumber ?? f.sessionToken.slice(-8)}</Text>
                  <Text style={styles.sessionMeta}>Overtime {f.overtimeMins} min · Rs {f.fineAmount}</Text>
                </View>
                <View style={[styles.overtimeBadge, { backgroundColor: '#FFF3E0', borderColor: '#E65100' }]}>
                  <Text style={[styles.overtimeBadgeText, { color: '#E65100' }]}>Rs {f.fineAmount}</Text>
                </View>
              </View>
            ))}
          </>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },

  header: {
    backgroundColor: '#E65100',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md + 4,
    paddingTop: Spacing.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  greeting:     { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  officerName:  { fontSize: 17, fontWeight: '800', color: Colors.white },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badgePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.white,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#E65100' },

  body: { padding: Spacing.lg, paddingBottom: 40 },

  zoneCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.md + 4, marginBottom: Spacing.md,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#E65100', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  zoneCardLeft:  { flex: 1 },
  zoneCardLabel: { fontSize: 10, color: Colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  zoneCardName:  { fontSize: 16, fontWeight: '800', color: Colors.text, marginTop: 2 },
  zoneCardCode:  { fontSize: 11, color: Colors.muted, marginTop: 2 },
  zoneStats:     { flexDirection: 'row', gap: 12 },
  zoneStat:      { alignItems: 'center' },
  zoneStatNum:   { fontSize: 20, fontWeight: '800', color: Colors.text },
  zoneStatLabel: { fontSize: 10, color: Colors.muted },

  summaryRow:  { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  summaryCard: {
    flex: 1, backgroundColor: Colors.white, borderRadius: BorderRadius.md,
    padding: Spacing.md, borderLeftWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  summaryNum:   { fontSize: 22, fontWeight: '800', color: Colors.text },
  summaryLabel: { fontSize: 11, color: Colors.muted, marginTop: 2 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  sectionTitle:  { fontSize: 13, fontWeight: '700', color: Colors.text },

  sessionCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    flexDirection: 'row', alignItems: 'center',
    borderLeftWidth: 3, borderLeftColor: Colors.green,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  sessionCardOvertime: { borderLeftColor: Colors.red },
  sessionLeft: { flex: 1, gap: 3 },
  plateWrap:   {},
  plateNum:    { fontSize: 14, fontWeight: '800', color: Colors.text, letterSpacing: 1 },
  sessionMeta: { fontSize: 11, color: Colors.muted },

  overtimeBadge: {
    backgroundColor: Colors.redLight, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.red,
  },
  overtimeBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.red },

  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.greenLight, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  activeDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green },
  activeBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.green },
});
