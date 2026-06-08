import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Alert, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

import { Colors, Spacing, BorderRadius } from '@/utils/theme';
import { useStore, primaryVehicle, userPlate, userVehicleType } from '@/store/useStore';
import { RootStackParamList } from '@/navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const VEHICLE_LABELS: Record<string, string> = {
  '2w': 'Bike / Scooter',
  '4w': 'Car / Jeep',
  ev:   'Electric Vehicle',
  bus:  'Bus / Minibus',
};
const VEHICLE_ICONS: Record<string, string> = {
  '2w': 'motorbike',
  '4w': 'car',
  ev:   'lightning-bolt',
  bus:  'bus',
};

function MenuItem({
  icon, label, sublabel, onPress, danger, rightEl,
}: {
  icon: string; label: string; sublabel?: string;
  onPress?: () => void; danger?: boolean;
  rightEl?: React.ReactNode;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7} disabled={!onPress}>
      <View style={[styles.menuIconBox, danger && styles.menuIconBoxDanger]}>
        <Icon name={icon as any} size={18} color={danger ? Colors.red : Colors.primary} />
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, danger && { color: Colors.red }]}>{label}</Text>
        {sublabel ? <Text style={styles.menuSub}>{sublabel}</Text> : null}
      </View>
      {rightEl ?? <Icon name="chevron-right" size={18} color={Colors.border} />}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation<NavProp>();
  const { user, logout, activeSession, walletBalance, setProfilePicture } = useStore();
  const [pickerLoading, setPickerLoading] = React.useState(false);

  // Restore profile picture from AsyncStorage on first mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    AsyncStorage.getItem('nsp_profile_pic').then(uri => {
      if (uri) setProfilePicture(uri);
    });
  }, []); // intentionally runs once on mount only

  if (!user) return null;

  const pv        = primaryVehicle(user);
  const plate     = userPlate(user);
  const vType     = userVehicleType(user);
  const totalVehicles = user.vehicles.length;
  const initials  = user.fullName.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const handlePickPhoto = () => {
    Alert.alert(
      'Profile Photo',
      'Choose how to set your profile picture',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission needed', 'Camera permission is required to take a photo.');
              return;
            }
            setPickerLoading(true);
            try {
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
              });
              if (!result.canceled && result.assets[0]) {
                const uri = result.assets[0].uri;
                setProfilePicture(uri);
                await AsyncStorage.setItem('nsp_profile_pic', uri);
              }
            } finally {
              setPickerLoading(false);
            }
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission needed', 'Gallery permission is required to choose a photo.');
              return;
            }
            setPickerLoading(true);
            try {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
              });
              if (!result.canceled && result.assets[0]) {
                const uri = result.assets[0].uri;
                setProfilePicture(uri);
                await AsyncStorage.setItem('nsp_profile_pic', uri);
              }
            } finally {
              setPickerLoading(false);
            }
          },
        },
        ...(user.profilePicture ? [{
          text: 'Remove Photo',
          style: 'destructive' as const,
          onPress: async () => {
            setProfilePicture(null);
            await AsyncStorage.removeItem('nsp_profile_pic');
          },
        }] : []),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  const handleLogout = () => {
    if (activeSession) {
      Alert.alert(
        'Active Session',
        'You have an active parking session. Please end it before logging out.',
        [{ text: 'OK' }],
      );
      return;
    }
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove(['auth_token', 'nsp_user']);
            logout();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>

        {/* ── Avatar + name card ── */}
        <View style={styles.profileCard}>
          <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.85} style={styles.avatarWrap}>
            {user.profilePicture ? (
              <Image source={{ uri: user.profilePicture }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                {pickerLoading
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.avatarText}>{initials}</Text>
                }
              </View>
            )}
            {/* camera badge */}
            <View style={styles.cameraBadge}>
              {pickerLoading
                ? <ActivityIndicator size={10} color={Colors.white} />
                : <Icon name="camera" size={12} color={Colors.white} />
              }
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user.fullName}</Text>
            <View style={styles.idRow}>
              <Icon name="card-account-details-outline" size={13} color={Colors.muted} />
              <Text style={styles.idText}>{user.nationalId}</Text>
            </View>
            {user.phone ? (
              <View style={styles.idRow}>
                <Icon name="phone-outline" size={13} color={Colors.muted} />
                <Text style={styles.idText}>{user.phone}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Quick stats ── */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>Rs {walletBalance}</Text>
            <Text style={styles.statLabel}>Wallet</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalVehicles}</Text>
            <Text style={styles.statLabel}>{totalVehicles === 1 ? 'Vehicle' : 'Vehicles'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statValue, activeSession && { color: Colors.green }]}>
              {activeSession ? 'Active' : 'None'}
            </Text>
            <Text style={styles.statLabel}>Session</Text>
          </View>
        </View>

        {/* ── Primary vehicle pill ── */}
        {pv && (
          <TouchableOpacity
            style={styles.primaryVehicleRow}
            onPress={() => navigation.navigate('Vehicles')}
            activeOpacity={0.8}
          >
            <View style={styles.primaryVehicleLeft}>
              <Icon name={VEHICLE_ICONS[vType] as any} size={20} color={Colors.primary} />
              <View>
                <Text style={styles.primaryVehiclePlate}>{plate}</Text>
                <Text style={styles.primaryVehicleType}>{VEHICLE_LABELS[vType]} · Primary</Text>
              </View>
            </View>
            <Icon name="chevron-right" size={18} color={Colors.muted} />
          </TouchableOpacity>
        )}

        {/* ── Account section ── */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="car-multiple"
            label="My Vehicles"
            sublabel={`${totalVehicles} plate${totalVehicles !== 1 ? 's' : ''} registered`}
            onPress={() => navigation.navigate('Vehicles')}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="wallet-outline"
            label="Wallet"
            sublabel={`Balance: Rs ${walletBalance}`}
            onPress={() => (navigation as any).navigate('Main', { screen: 'Wallet' })}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="history"
            label="Parking History"
            onPress={() => (navigation as any).navigate('Main', { screen: 'History' })}
          />
        </View>

        {/* ── Support section ── */}
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="shield-check-outline"
            label="Privacy Policy"
            sublabel="How we use your data"
            onPress={() => navigation.navigate('PrivacyPolicy')}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="help-circle-outline"
            label="Help & FAQ"
            onPress={() => navigation.navigate('HelpFAQ')}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="information-outline"
            label="App Version"
            sublabel="NSP Driver v1.0.0"
            rightEl={<View />}
          />
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Icon name="logout" size={18} color={Colors.red} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Nepal Smart Parking · Kathmandu, Nepal</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F6FA' },

  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.text },

  body: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },

  // Profile card
  profileCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, flexDirection: 'row', alignItems: 'center',
    gap: Spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  avatarWrap: {
    width: 64, height: 64, borderRadius: 32,
    position: 'relative',
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.border,
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: Colors.white },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primary,
    borderWidth: 2, borderColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  userName: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  idText: { fontSize: 12, color: Colors.muted },

  // Stats
  statsRow: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    flexDirection: 'row', alignItems: 'stretch',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    overflow: 'hidden',
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md + 2 },
  statValue: { fontSize: 18, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },

  // Primary vehicle
  primaryVehicleRow: {
    backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.lg,
    padding: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.primary + '33',
  },
  primaryVehicleLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  primaryVehiclePlate: { fontSize: 15, fontWeight: '800', color: Colors.text, letterSpacing: 0.5 },
  primaryVehicleType:  { fontSize: 11, color: Colors.primary, marginTop: 2, fontWeight: '600' },

  // Section title
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: -4 },

  // Menu card
  menuCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md + 2,
  },
  menuIconBox: {
    width: 36, height: 36, borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  menuIconBoxDanger: { backgroundColor: Colors.redLight },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  menuSub:   { fontSize: 11, color: Colors.muted, marginTop: 1 },
  menuDivider: { height: 1, backgroundColor: Colors.border, marginLeft: Spacing.lg + 36 + Spacing.md },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md + 4,
    borderWidth: 1.5, borderColor: Colors.red + '40',
    shadowColor: '#000', shadowOpacity: 0.03, elevation: 1,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: Colors.red },

  footer: { textAlign: 'center', fontSize: 11, color: Colors.muted, marginTop: Spacing.sm },
});
