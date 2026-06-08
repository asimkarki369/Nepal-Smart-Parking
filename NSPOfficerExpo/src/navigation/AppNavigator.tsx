import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, FlatList } from 'react-native';

import { Colors, Spacing, BorderRadius } from '@/utils/theme';
import { useStore } from '@/store/useStore';
import { RootStackParamList, OfficerTabParamList } from './types';

import OfficerLoginScreen     from '@/screens/officer/OfficerLoginScreen';
import OfficerDashboardScreen from '@/screens/officer/OfficerDashboardScreen';
import OfficerScanScreen      from '@/screens/officer/OfficerScanScreen';
import SessionVerifyScreen    from '@/screens/officer/SessionVerifyScreen';

const Stack      = createNativeStackNavigator<RootStackParamList>();
const OfficerTab = createBottomTabNavigator<OfficerTabParamList>();

function OfficerTabs() {
  const { issuedFines, officer } = useStore();
  const todayFines = issuedFines.filter(f => f.officerId === officer?.id).length;
  const insets     = useSafeAreaInsets();
  const TAB_H      = 56 + insets.bottom;

  return (
    <OfficerTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border, borderTopWidth: 1,
          height: TAB_H, paddingTop: 6,
          paddingBottom: insets.bottom + 4,
          elevation: 16,
        },
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: Colors.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginTop: -2 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <OfficerTab.Screen
        name="OfficerDashboard"
        component={OfficerDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Icon name="view-dashboard-outline" color={color} size={size} />,
        }}
      />
      <OfficerTab.Screen
        name="OfficerScan"
        component={OfficerScanScreen}
        options={{
          tabBarLabel: 'Verify',
          tabBarIcon: ({ color, size }) => <Icon name="magnify" color={color} size={size} />,
        }}
      />
      <OfficerTab.Screen
        name="OfficerFines"
        component={OfficerFinesScreen}
        options={{
          tabBarLabel: 'Fines',
          tabBarIcon: ({ color, size }) => <Icon name="receipt" color={color} size={size} />,
          tabBarBadge: todayFines > 0 ? todayFines : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.primary },
        }}
      />
    </OfficerTab.Navigator>
  );
}

export default function AppNavigator() {
  const { isOfficer } = useStore();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isOfficer ? (
          <Stack.Screen name="OfficerLogin" component={OfficerLoginScreen} />
        ) : (
          <>
            <Stack.Screen name="OfficerMain"   component={OfficerTabs} />
            <Stack.Screen name="SessionVerify" component={SessionVerifyScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ── Fines list (inline) ───────────────────────────────────────────────────────
function OfficerFinesScreen() {
  const { issuedFines, officer } = useStore();
  const fines = issuedFines.filter(f => f.officerId === officer?.id);

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
      <View style={fineStyles.header}>
        <Text style={fineStyles.title}>Fines Issued</Text>
        <Text style={fineStyles.sub}>{fines.length} total this session</Text>
      </View>
      {fines.length === 0 ? (
        <View style={fineStyles.empty}>
          <Icon name="receipt-outline" size={44} color={Colors.muted} />
          <Text style={fineStyles.emptyText}>No fines issued yet</Text>
        </View>
      ) : (
        <FlatList
          data={fines}
          keyExtractor={f => f.fineId}
          contentContainerStyle={{ padding: Spacing.lg }}
          renderItem={({ item }) => (
            <View style={fineStyles.row}>
              <View style={fineStyles.rowLeft}>
                <Text style={fineStyles.plate}>{item.plateNumber}</Text>
                <Text style={fineStyles.meta}>{item.zoneName} · {item.overtimeMins}m overtime</Text>
                <Text style={fineStyles.time}>
                  {item.issuedAt.toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <View style={fineStyles.amountBadge}>
                <Text style={fineStyles.amountText}>Rs {item.fineAmount}</Text>
                <Text style={fineStyles.paidText}>{item.paid ? 'PAID' : 'UNPAID'}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const fineStyles = StyleSheet.create({
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 52, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  title:      { fontSize: 18, fontWeight: '800', color: Colors.white },
  sub:        { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  emptyText:  { fontSize: 14, color: Colors.muted },
  row: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    flexDirection: 'row', alignItems: 'center',
    borderLeftWidth: 3, borderLeftColor: Colors.primary,
    shadowColor: '#000', shadowOpacity: 0.03, elevation: 1,
  },
  rowLeft:    { flex: 1 },
  plate:      { fontSize: 14, fontWeight: '800', color: Colors.text, letterSpacing: 0.5 },
  meta:       { fontSize: 11, color: Colors.muted, marginTop: 2 },
  time:       { fontSize: 10, color: Colors.muted, marginTop: 1 },
  amountBadge:{ alignItems: 'center' },
  amountText: { fontSize: 15, fontWeight: '800', color: Colors.primary },
  paidText:   { fontSize: 9, color: Colors.muted, fontWeight: '700', marginTop: 2 },
});
