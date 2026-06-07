import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ActivityIndicator, FlatList, RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { Colors, Spacing, BorderRadius, Typography } from '@/utils/theme';
import { sessionsAPI } from '@/services/api';
import { useStore, SessionHistory } from '@/store/useStore';

const MOCK_HISTORY: SessionHistory[] = [
  {
    sessionId: 'ses_001', zoneName: 'New Road', zoneCode: 'Z-KMC-01',
    date: '2026-05-31 14:30', duration: '1h', totalPaid: 88, status: 'completed',
  },
  {
    sessionId: 'ses_002', zoneName: 'Durbar Marg', zoneCode: 'Z-KMC-04',
    date: '2026-05-30 10:15', duration: '30m', totalPaid: 44, status: 'completed',
  },
  {
    sessionId: 'ses_003', zoneName: 'Putalisadak', zoneCode: 'Z-KMC-02',
    date: '2026-05-28 16:00', duration: '2h', totalPaid: 176, status: 'fine',
  },
  {
    sessionId: 'ses_004', zoneName: 'New Road', zoneCode: 'Z-KMC-01',
    date: '2026-05-25 09:00', duration: '45m', totalPaid: 66, status: 'completed',
  },
  {
    sessionId: 'ses_005', zoneName: 'New Road (Pokhara)', zoneCode: 'Z-PMC-01',
    date: '2026-05-20 11:30', duration: '1h', totalPaid: 66, status: 'completed',
  },
];

const STATUS_CONFIG = {
  completed: { label: 'Completed', color: Colors.green, bg: '#E8F5E9', icon: 'check-circle-outline' },
  fine: { label: 'Fine issued', color: Colors.red, bg: '#FDECEA', icon: 'alert-circle-outline' },
  active: { label: 'Active', color: Colors.primary, bg: '#EEF2FB', icon: 'clock-outline' },
} as const;

function HistoryItem({ item }: { item: SessionHistory }) {
  const sc = STATUS_CONFIG[item.status];
  return (
    <View style={styles.item}>
      <View style={[styles.itemIcon, { backgroundColor: sc.bg }]}>
        <Icon name={sc.icon as any} size={20} color={sc.color} />
      </View>
      <View style={styles.itemBody}>
        <View style={styles.itemTop}>
          <Text style={styles.itemZone}>{item.zoneName}</Text>
          <Text style={styles.itemAmount}>Rs {item.totalPaid}</Text>
        </View>
        <View style={styles.itemBottom}>
          <Text style={styles.itemMeta}>{item.zoneCode} · {item.duration}</Text>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
          </View>
        </View>
        <Text style={styles.itemDate}>{item.date}</Text>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const { sessionHistory, setSessionHistory } = useStore();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [totalSpent, setTotalSpent] = useState(0);

  const data = sessionHistory.length > 0 ? sessionHistory : MOCK_HISTORY;

  const loadHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await sessionsAPI.getHistory();
      const history: SessionHistory[] = res.data.sessions;
      setSessionHistory(history);
      setTotalSpent(history.reduce((sum, s) => sum + s.totalPaid, 0));
    } catch {
      // Use mock data — compute total from it
      setTotalSpent(MOCK_HISTORY.reduce((sum, s) => sum + s.totalPaid, 0));
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [setSessionHistory]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    if (sessionHistory.length > 0) {
      setTotalSpent(sessionHistory.reduce((sum, s) => sum + s.totalPaid, 0));
    } else {
      setTotalSpent(MOCK_HISTORY.reduce((sum, s) => sum + s.totalPaid, 0));
    }
  }, [sessionHistory]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Parking History</Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={item => item.sessionId}
          renderItem={({ item }) => <HistoryItem item={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadHistory(true)}
              colors={[Colors.primary]}
            />
          }
          ListHeaderComponent={
            <View style={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{data.length}</Text>
                <Text style={styles.summaryLabel}>Total sessions</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  {data.filter(s => s.status === 'completed').length}
                </Text>
                <Text style={styles.summaryLabel}>Completed</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>Rs {totalSpent}</Text>
                <Text style={styles.summaryLabel}>Total paid</Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="history" size={40} color={Colors.muted} />
              <Text style={styles.emptyTitle}>No history yet</Text>
              <Text style={styles.emptySubtitle}>Your parking sessions will appear here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F6FA' },

  header: {
    backgroundColor: Colors.primary,
    paddingTop: Spacing.xxl + 8, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.white },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  list: { padding: Spacing.lg, paddingBottom: Spacing.xl },

  summaryCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    flexDirection: 'row', padding: Spacing.md,
    marginBottom: Spacing.lg,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm },
  summaryDivider: { width: 1, backgroundColor: Colors.border },
  summaryValue: { fontSize: 17, fontWeight: '800', color: Colors.text },
  summaryLabel: { fontSize: 11, color: Colors.muted, marginTop: 2 },

  item: {
    flexDirection: 'row', gap: Spacing.sm,
    backgroundColor: Colors.white, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  itemIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  itemBody: { flex: 1 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemZone: { fontSize: 14, fontWeight: '700', color: Colors.text },
  itemAmount: { fontSize: 14, fontWeight: '700', color: Colors.text },
  itemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 },
  itemMeta: { fontSize: 12, color: Colors.muted },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: '700' },
  itemDate: { fontSize: 11, color: Colors.muted, marginTop: 4 },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: Spacing.sm },
  emptyTitle: { ...Typography.h3, color: Colors.muted },
  emptySubtitle: { fontSize: 13, color: Colors.muted, textAlign: 'center' },
});
