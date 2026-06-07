import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius } from '@/utils/theme';
import { RootStackParamList } from '@/navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'RolePicker'>;

export default function RolePickerScreen() {
  const navigation = useNavigation<NavProp>();
  const insets     = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} translucent />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Icon name="parking" size={40} color={Colors.primary} />
        </View>
        <Text style={styles.appName}>Nepal Smart Parking</Text>
        <Text style={styles.tagline}>Select your role to continue</Text>
      </View>

      <View style={styles.body}>
        {/* Driver card */}
        <TouchableOpacity
          style={styles.roleCard}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.88}
        >
          <View style={[styles.roleIconWrap, { backgroundColor: Colors.primaryLight }]}>
            <Icon name="car" size={36} color={Colors.primary} />
          </View>
          <View style={styles.roleText}>
            <Text style={styles.roleTitle}>Driver</Text>
            <Text style={styles.roleSub}>Find zones, park and pay via eSewa / Khalti / ConnectIPS</Text>
          </View>
          <Icon name="chevron-right" size={22} color={Colors.muted} />
        </TouchableOpacity>

        {/* Officer card */}
        <TouchableOpacity
          style={[styles.roleCard, styles.roleCardOfficer]}
          onPress={() => navigation.navigate('OfficerLogin')}
          activeOpacity={0.88}
        >
          <View style={[styles.roleIconWrap, { backgroundColor: '#FFF3E0' }]}>
            <Icon name="shield-star" size={36} color="#E65100" />
          </View>
          <View style={styles.roleText}>
            <Text style={[styles.roleTitle, { color: '#E65100' }]}>Parking Officer</Text>
            <Text style={styles.roleSub}>Verify sessions, issue fines and manage zones</Text>
          </View>
          <Icon name="chevron-right" size={22} color={Colors.muted} />
        </TouchableOpacity>

        <Text style={styles.footer}>
          Authorised personnel only · Nepal Smart Parking v1.0
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },

  header: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    paddingTop: Spacing.xxl + 16,
    paddingBottom: Spacing.xxl + 12,
    gap: Spacing.sm,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  appName: { fontSize: 22, fontWeight: '800', color: Colors.white, letterSpacing: 0.3 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },

  body: {
    flex: 1, paddingHorizontal: Spacing.lg + 4,
    paddingTop: Spacing.xl + 8, gap: Spacing.md,
  },

  roleCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.light,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md + 4,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  roleCardOfficer: { borderColor: '#FFB74D', backgroundColor: '#FFFDE7' },
  roleIconWrap: {
    width: 64, height: 64, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  roleText:  { flex: 1 },
  roleTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  roleSub:   { fontSize: 12, color: Colors.muted, marginTop: 3, lineHeight: 18 },

  footer: {
    fontSize: 11, color: Colors.muted,
    textAlign: 'center', marginTop: Spacing.lg,
  },
});
