// src/navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { Colors } from './theme';
import { useStore } from './useStore';

// Screens
import LoginScreen from './LoginScreen';
import OTPScreen from './OTPScreen';
import RegisterScreen from './RegisterScreen';
import HomeScreen from './HomeScreen';
import ZoneDetailScreen from './ZoneDetailScreen';
import PaymentConfirmScreen from './PaymentConfirmScreen';
import SessionScreen from './SessionScreen';
import HistoryScreen from './HistoryScreen';
import WalletScreen from './WalletScreen';

export type RootStackParamList = {
  Login: undefined;
  OTP: { phone: string };
  Register: { phone: string };
  Main: undefined;
  ZoneDetail: { zoneCode: string };
  PaymentConfirm: { zoneCode: string; vehicleType: '2w' | '4w'; durationMinutes: number };
};

export type MainTabParamList = {
  Home: undefined;
  Session: undefined;
  Wallet: undefined;
  History: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const { activeSession } = useStore();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: Colors.white, borderTopColor: Colors.border, height: 60 },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen}
        options={{ tabBarIcon: ({ color, size }: { color: string; size: number }) => <Icon name="home" color={color} size={size} /> }} />
      <Tab.Screen name="Session" component={SessionScreen}
        options={{
          tabBarIcon: ({ color, size }: { color: string; size: number }) => <Icon name="clock-outline" color={color} size={size} />,
          tabBarBadge: activeSession ? ' ' : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.green, minWidth: 10, height: 10 },
        }} />
      <Tab.Screen name="Wallet" component={WalletScreen}
        options={{ tabBarIcon: ({ color, size }: { color: string; size: number }) => <Icon name="wallet-outline" color={color} size={size} /> }} />
      <Tab.Screen name="History" component={HistoryScreen}
        options={{ tabBarIcon: ({ color, size }: { color: string; size: number }) => <Icon name="history" color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated } = useStore();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="OTP" component={OTPScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="ZoneDetail" component={ZoneDetailScreen} />
            <Stack.Screen name="PaymentConfirm" component={PaymentConfirmScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
