import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { Colors } from '@/utils/theme';
import { useStore } from '@/store/useStore';
import { RootStackParamList, MainTabParamList, OfficerTabParamList } from './types';

// Driver screens
import RolePickerScreen    from '@/screens/RolePickerScreen';
import LoginScreen         from '@/screens/auth/LoginScreen';
import OTPScreen           from '@/screens/auth/OTPScreen';
import RegisterScreen      from '@/screens/auth/RegisterScreen';
import HomeScreen          from '@/screens/main/HomeScreen';
import ZoneDetailScreen    from '@/screens/main/ZoneDetailScreen';
import PaymentConfirmScreen from '@/screens/main/PaymentConfirmScreen';
import SessionScreen       from '@/screens/main/SessionScreen';
import HistoryScreen       from '@/screens/main/HistoryScreen';
import WalletScreen        from '@/screens/main/WalletScreen';

// Officer screens
import OfficerLoginScreen    from '@/screens/officer/OfficerLoginScreen';
import OfficerDashboardScreen from '@/screens/officer/OfficerDashboardScreen';
import OfficerScanScreen     from '@/screens/officer/OfficerScanScreen';
import SessionVerifyScreen   from '@/screens/officer/SessionVerifyScreen';

const Stack       = createNativeStackNavigator<RootStackParamList>();
const Tab         = createBottomTabNavigator<MainTabParamList>();
const OfficerTab  = createBottomTabNavigator<OfficerTabParamList>();

// ── Driver main tabs ──────────────────────────────────────────────────────────
function MainTabs() {
  const { activeSession } = useStore();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.white, borderTopColor: Colors.border,
          height: 64, paddingBottom: 8, paddingTop: 4,
          elevation: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ color, size }) => <Icon name="home" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Session"
        component={SessionScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Icon name="clock-outline" color={color} size={size} />,
          tabBarBadge: activeSession ? ' ' : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.green, minWidth: 10, height: 10 },
        }}
      />
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{ tabBarIcon: ({ color, size }) => <Icon name="wallet-outline" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarIcon: ({ color, size }) => <Icon name="history" color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}

// ── Officer main tabs ─────────────────────────────────────────────────────────
function OfficerTabs() {
  const { issuedFines, officer } = useStore();
  const todayFines = issuedFines.filter(f => f.officerId === officer?.id).length;

  return (
    <OfficerTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.white, borderTopColor: Colors.border,
          height: 64, paddingBottom: 8, paddingTop: 4,
          elevation: 12,
        },
        tabBarActiveTintColor: '#E65100',
        tabBarInactiveTintColor: Colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
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
          tabBarIcon: ({ color, size }) => <Icon name="qrcode-scan" color={color} size={size} />,
        }}
      />
      <OfficerTab.Screen
        name="OfficerFines"
        component={OfficerFinesScreen}
        options={{
          tabBarLabel: 'Fines',
          tabBarIcon: ({ color, size }) => <Icon name="receipt" color={color} size={size} />,
          tabBarBadge: todayFines > 0 ? todayFines : undefined,
          tabBarBadgeStyle: { backgroundColor: '#E65100' },
        }}
      />
    </OfficerTab.Navigator>
  );
}

// ── App navigator ─────────────────────────────────────────────────────────────
export default function AppNavigator() {
  const { isAuthenticated, isOfficer } = useStore();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* Not logged in at all → role picker */}
        {!isAuthenticated && !isOfficer && (
          <>
            <Stack.Screen name="RolePicker"    component={RolePickerScreen} />
            <Stack.Screen name="Login"         component={LoginScreen} />
            <Stack.Screen name="OTP"           component={OTPScreen} />
            <Stack.Screen name="Register"      component={RegisterScreen} />
            <Stack.Screen name="OfficerLogin"  component={OfficerLoginScreen} />
          </>
        )}

        {/* Driver authenticated */}
        {isAuthenticated && !isOfficer && (
          <>
            <Stack.Screen name="Main"           component={MainTabs} />
            <Stack.Screen name="ZoneDetail"     component={ZoneDetailScreen} />
            <Stack.Screen name="PaymentConfirm" component={PaymentConfirmScreen} />
          </>
        )}

        {/* Officer authenticated */}
        {isOfficer && !isAuthenticated && (
          <>
            <Stack.Screen name="OfficerMain"     component={OfficerTabs} />
            <Stack.Screen name="SessionVerify"   component={SessionVerifyScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ── Officer fines list (inline — small screen) ────────────────────────────────
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Spacing, BorderRadius } from '@/utils/theme';

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
                <Text style={fineStyles.plate}>{item.plateNumber ?? '—'}</Text>
                <Text style={fineStyles.meta}>{item.zoneName} · {item.overtimeMins}m overtime</Text>
                <Text style={fineStyles.time}>{item.issuedAt.toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit' })}</Text>
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
    backgroundColor: '#E65100',
    paddingTop: 52, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  title: { fontSize: 18, fontWeight: '800', color: Colors.white },
  sub:   { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  emptyText: { fontSize: 14, color: Colors.muted },
  row: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    flexDirection: 'row', alignItems: 'center',
    borderLeftWidth: 3, borderLeftColor: '#E65100',
    shadowColor: '#000', shadowOpacity: 0.03, elevation: 1,
  },
  rowLeft:    { flex: 1 },
  plate:      { fontSize: 14, fontWeight: '800', color: Colors.text, letterSpacing: 0.5 },
  meta:       { fontSize: 11, color: Colors.muted, marginTop: 2 },
  time:       { fontSize: 10, color: Colors.muted, marginTop: 1 },
  amountBadge:{ alignItems: 'center' },
  amountText: { fontSize: 15, fontWeight: '800', color: '#E65100' },
  paidText:   { fontSize: 9, color: Colors.muted, fontWeight: '700', marginTop: 2 },
});
