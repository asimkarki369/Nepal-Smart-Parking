// src/screens/HomeScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors, Spacing, BorderRadius, Typography } from './theme';
import { mockZones } from './api';
import { useStore } from './useStore';
import { RootStackParamList } from './AppNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Main'>;

function OccupancyTag({ pct }: { pct: number }) {
  if (pct >= 95) return <View style={[styles.tag, { backgroundColor: Colors.tagRedBg }]}>
    <Text style={{ color: Colors.tagRedText, fontSize: 11, fontWeight: '700' }}>Full</Text></View>;
  if (pct >= 70) return <View style={[styles.tag, { backgroundColor: Colors.tagAmberBg }]}>
    <Text style={{ color: Colors.tagAmberText, fontSize: 11, fontWeight: '700' }}>
      {Math.round(100 - pct)}% free
    </Text></View>;
  return <View style={[styles.tag, { backgroundColor: Colors.tagGreenBg }]}>
    <Text style={{ color: Colors.tagGreenText, fontSize: 11, fontWeight: '700' }}>
      {Math.round(100 - pct)}% free
    </Text></View>;
}

function PinColor(pct: number) {
  if (pct >= 95) return Colors.red;
  if (pct >= 70) return Colors.accent;
  return Colors.green;
}

export default function HomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { user, activeSession } = useStore();
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState({ lat: 27.7048, lng: 85.3132 });
  const [zones] = useState(mockZones);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Geolocation.getCurrentPosition(
      pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 5000 },
    );
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    // Re-fetch nearby zones in production
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreet}>Good morning,</Text>
          <Text style={styles.headerName}>{user?.fullName ?? 'Driver'}</Text>
        </View>
        <View style={styles.plateBadge}>
          <Text style={styles.plateLabel}>Plate</Text>
          <Text style={styles.plateValue}>{user?.plateNumber ?? 'BA 1 JA 2034'}</Text>
        </View>
      </View>

      {/* Active session banner */}
      {activeSession && (
        <TouchableOpacity style={styles.sessionBanner}
          onPress={() => navigation.navigate('Main' as any)}>
          <Icon name="clock-check-outline" size={18} color={Colors.white} />
          <Text style={styles.sessionBannerText}>Active session — {activeSession.zoneName}</Text>
          <Icon name="chevron-right" size={18} color={Colors.white} />
        </TouchableOpacity>
      )}

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}>

        {/* Map */}
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: location.lat, longitude: location.lng,
            latitudeDelta: 0.02, longitudeDelta: 0.02,
          }}>
          {/* User location */}
          <Marker coordinate={{ latitude: location.lat, longitude: location.lng }}>
            <View style={styles.youMarker} />
          </Marker>

          {/* Zone pins */}
          {zones.map((z: any) => (
            <Marker key={z.code}
              coordinate={{ latitude: z.latitude, longitude: z.longitude }}
              onPress={() => navigation.navigate('ZoneDetail', { zoneCode: z.code })}>
              <View style={[styles.zonePin, { backgroundColor: PinColor(z.occupancyPercent) }]}>
                <Icon name="parking" size={14} color={Colors.white} />
              </View>
              <Callout tooltip>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{z.name}</Text>
                  <Text style={styles.calloutCode}>{z.code}</Text>
                  <Text style={styles.calloutRate}>Rs {z.rate4w}/hr (4W) · Rs {z.rate2w}/hr (2W)</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>

        {/* Zone legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: Colors.green }]} /><Text style={styles.legendText}>Available</Text></View>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: Colors.accent }]} /><Text style={styles.legendText}>Moderate</Text></View>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: Colors.red }]} /><Text style={styles.legendText}>Full</Text></View>
        </View>

        {/* Zone list */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            <Icon name="format-list-bulleted" size={16} color={Colors.primary} /> Nearby Zones
          </Text>
          {loading ? <ActivityIndicator color={Colors.primary} /> : zones.map((z: any) => (
            <TouchableOpacity key={z.code} style={styles.zoneItem}
              onPress={() => navigation.navigate('ZoneDetail', { zoneCode: z.code })}>
              <View style={styles.zoneIcon}>
                <Icon name="parking" size={20} color={Colors.primary} />
              </View>
              <View style={styles.zoneInfo}>
                <Text style={styles.zoneName}>{z.name} — {z.code}</Text>
                <View style={styles.zoneMeta}>
                  <Text style={styles.zoneCity}>{z.city} · </Text>
                  <OccupancyTag pct={z.occupancyPercent} />
                </View>
              </View>
              <Text style={styles.zoneRate}>Rs {z.rate4w}/hr</Text>
            </TouchableOpacity>
          ))}
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
  headerGreet: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  headerName: { fontSize: 16, color: Colors.white, fontWeight: '700', marginTop: 2 },
  plateBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'flex-end',
  },
  plateLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)' },
  plateValue: { fontSize: 13, color: Colors.white, fontWeight: '700', fontFamily: 'Courier' },
  sessionBanner: {
    backgroundColor: Colors.green, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.sm,
  },
  sessionBannerText: { flex: 1, fontSize: 13, color: Colors.white, fontWeight: '600' },
  map: { height: 200, margin: Spacing.md, borderRadius: BorderRadius.lg },
  youMarker: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.primary,
    borderWidth: 3, borderColor: Colors.white,
  },
  zonePin: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center',
    justifyContent: 'center', borderWidth: 2, borderColor: Colors.white,
  },
  callout: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.md, padding: Spacing.sm,
    minWidth: 140, borderWidth: 1, borderColor: Colors.border,
  },
  calloutTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  calloutCode: { fontSize: 11, color: Colors.primary, fontFamily: 'Courier', marginTop: 2 },
  calloutRate: { fontSize: 11, color: Colors.muted, marginTop: 4 },
  legend: {
    flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: Colors.muted, fontWeight: '500' },
  card: {
    backgroundColor: Colors.white, margin: Spacing.md, marginTop: 0,
    borderRadius: BorderRadius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  zoneItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  zoneIcon: {
    width: 36, height: 36, borderRadius: BorderRadius.sm,
    backgroundColor: Colors.badgeBg, alignItems: 'center', justifyContent: 'center',
  },
  zoneInfo: { flex: 1 },
  zoneName: { fontSize: 13, fontWeight: '700', color: Colors.text },
  zoneMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  zoneCity: { fontSize: 11, color: Colors.muted },
  zoneRate: { fontSize: 13, fontWeight: '700', color: Colors.green },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.pill },
});
