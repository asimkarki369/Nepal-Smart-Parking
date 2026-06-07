/**
 * Web stub for react-native-maps.
 * react-native-maps is native-only — on web we render a placeholder card.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MapPlaceholder = ({ style, children }: any) => (
  <View style={[styles.container, style]}>
    <Text style={styles.icon}>🗺️</Text>
    <Text style={styles.title}>Map View</Text>
    <Text style={styles.sub}>Interactive map is available on the mobile app</Text>
    {children}
  </View>
);

const Marker = ({ children }: any) => <>{children ?? null}</>;
const Callout = ({ children }: any) => <>{children ?? null}</>;
const Circle  = ({ children }: any) => <>{children ?? null}</>;
const Polyline = ({ children }: any) => <>{children ?? null}</>;
const PROVIDER_GOOGLE = 'google';

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E8F0E9',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 8,
  },
  icon:  { fontSize: 48 },
  title: { fontSize: 16, fontWeight: '700', color: '#1A3A6B' },
  sub:   { fontSize: 12, color: '#666', textAlign: 'center', paddingHorizontal: 24 },
});

export default MapPlaceholder;
export { Marker, Callout, Circle, Polyline, PROVIDER_GOOGLE };
