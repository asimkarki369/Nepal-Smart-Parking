import 'react-native-gesture-handler';
import React from 'react';
import { View, Text, StyleSheet, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from '@/navigation/AppNavigator';

// Suppress known benign warnings from third-party native packages
LogBox.ignoreLogs([
  // react-native-maps / expo-notifications NativeEventEmitter boilerplate
  'new NativeEventEmitter',
  // reanimated strict-mode worklet warning during fast refresh
  "[Reanimated]",
  // react-native-maps Google Maps init message
  'GoogleMaps',
  // expo-notifications on Android without a physical device
  'expo-notifications',
  // Non-serializable navigation state (dates in params)
  'Non-serializable values were found in the navigation state',
  // Require cycle from expo internals
  'Require cycle:',
  // New Architecture (RN 0.85+) — LayoutAnimation is a no-op in Fabric, expected
  'setLayoutAnimationEnabledExperimental',
]);

// ── Error boundary — catches render crashes and shows a message ───────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <View style={styles.err}>
          <Text style={styles.errIcon}>⚠️</Text>
          <Text style={styles.errTitle}>Something went wrong</Text>
          <Text style={styles.errMsg}>{String(this.state.error)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AppNavigator />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  err: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, backgroundColor: '#fff', gap: 12,
  },
  errIcon:  { fontSize: 48 },
  errTitle: { fontSize: 18, fontWeight: '700', color: '#c0392b' },
  errMsg:   { fontSize: 12, color: '#666', textAlign: 'center' },
});
