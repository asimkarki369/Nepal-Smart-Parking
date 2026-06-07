import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Modal, TextInput, SafeAreaView, StatusBar,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Colors, Spacing, BorderRadius } from '@/utils/theme';
import { useStore, VehicleType } from '@/store/useStore';

const VEHICLE_ICONS: Record<VehicleType, string> = {
  '2w': 'motorbike',
  '4w': 'car',
  ev:   'lightning-bolt',
  bus:  'bus',
};
const VEHICLE_LABELS: Record<VehicleType, string> = {
  '2w': 'Bike / Scooter',
  '4w': 'Car / Jeep',
  ev:   'Electric Vehicle',
  bus:  'Bus / Minibus',
};

// Nepal license plate widget
function LicensePlate({ plate }: { plate: string }) {
  return (
    <View style={plate_styles.wrap}>
      <View style={plate_styles.blueBar} />
      <Text style={plate_styles.plateText}>{plate}</Text>
    </View>
  );
}

const plate_styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'stretch',
    borderWidth: 1.5, borderColor: '#CCC',
    borderRadius: 6, overflow: 'hidden',
    backgroundColor: Colors.white,
  },
  blueBar: { width: 6, backgroundColor: '#1A56DB' },
  plateText: {
    paddingHorizontal: 12, paddingVertical: 6,
    fontSize: 16, fontWeight: '800', color: Colors.text, letterSpacing: 1,
  },
});

export default function VehiclesScreen() {
  const navigation = useNavigation();
  const { user, setUser } = useStore();
  const [menuVisible, setMenuVisible] = useState(false);
  const [addVisible,  setAddVisible]  = useState(false);
  const [newPlate,    setNewPlate]    = useState('');

  if (!user) return null;

  const handleDelete = () => {
    setMenuVisible(false);
    Alert.alert(
      'Remove Vehicle',
      `Remove ${user.plateNumber} from your account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: () => Alert.alert('Info', 'Contact support to remove your primary vehicle.'),
        },
      ],
    );
  };

  const handleAddVehicle = () => {
    if (newPlate.trim().length < 4) {
      Alert.alert('Invalid plate', 'Please enter a valid plate number.');
      return;
    }
    Alert.alert('Coming Soon', 'Multiple vehicle support will be available in the next update.');
    setAddVisible(false);
    setNewPlate('');
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vehicles</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Primary vehicle card */}
        <View style={styles.vehicleCard}>
          {/* Car icon */}
          <Icon name={VEHICLE_ICONS[user.vehicleType] as any} size={28} color={Colors.primary} />

          {/* Plate */}
          <LicensePlate plate={user.plateNumber} />

          {/* Verified badge */}
          {user.plateVerified && (
            <View style={styles.verifiedBadge}>
              <Icon name="check-circle" size={14} color={Colors.green} />
            </View>
          )}

          {/* Three-dot menu */}
          <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuVisible(true)}>
            <Icon name="dots-vertical" size={20} color={Colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Vehicle type label */}
        <Text style={styles.vehicleTypeLabel}>
          {VEHICLE_LABELS[user.vehicleType]}
          {!user.plateVerified && (
            <Text style={styles.unverifiedNote}> · Unverified</Text>
          )}
        </Text>

        {/* Unverified warning */}
        {!user.plateVerified && (
          <View style={styles.warningBanner}>
            <Icon name="shield-alert-outline" size={16} color={Colors.orange} />
            <Text style={styles.warningText}>
              Your plate is self-declared. An officer may verify it during parking.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add vehicle button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddVisible(true)}>
          <Icon name="plus" size={20} color={Colors.white} />
          <Text style={styles.addBtnText}>Add vehicle</Text>
        </TouchableOpacity>
      </View>

      {/* Three-dot menu modal */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuSheet}>
            <TouchableOpacity style={styles.menuItem} onPress={() => setMenuVisible(false)}>
              <Icon name="pencil-outline" size={18} color={Colors.text} />
              <Text style={styles.menuItemText}>Edit plate number</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
              <Icon name="delete-outline" size={18} color={Colors.red} />
              <Text style={[styles.menuItemText, { color: Colors.red }]}>Remove vehicle</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add vehicle modal */}
      <Modal visible={addVisible} transparent animationType="slide" onRequestClose={() => setAddVisible(false)}>
        <View style={styles.addOverlay}>
          <View style={styles.addSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.addTitle}>Add Vehicle</Text>

            <Text style={styles.addLabel}>Plate Number</Text>
            <View style={styles.addInputWrap}>
              <Icon name="card-text-outline" size={18} color={Colors.muted} style={{ marginLeft: 12 }} />
              <TextInput
                style={styles.addInput}
                placeholder="e.g. BA 1 KHA 1234"
                placeholderTextColor={Colors.muted}
                value={newPlate}
                onChangeText={t => setNewPlate(t.toUpperCase())}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.addBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddVehicle}>
                <Text style={styles.saveBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },

  body: { padding: Spacing.lg, gap: Spacing.sm },

  vehicleCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.light, borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  verifiedBadge: { marginLeft: -4 },
  menuBtn:       { marginLeft: 'auto' as any },

  vehicleTypeLabel: { fontSize: 13, color: Colors.muted, marginLeft: 4 },
  unverifiedNote:   { color: Colors.orange },

  warningBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.orangeLight, borderRadius: BorderRadius.sm,
    padding: Spacing.md,
  },
  warningText: { fontSize: 13, color: Colors.orange, flex: 1, lineHeight: 18 },

  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  addBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  addBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },

  // Menu modal
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  menuSheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: 32,
  },
  menuItem:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  menuItemText: { fontSize: 15, color: Colors.text, fontWeight: '500' },
  menuDivider:  { height: 1, backgroundColor: Colors.border },

  // Add modal
  addOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  addSheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.lg, paddingBottom: 32,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16,
  },
  addTitle:    { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  addLabel:    { fontSize: 13, fontWeight: '600', color: Colors.muted, marginBottom: 6 },
  addInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, backgroundColor: Colors.light, marginBottom: Spacing.lg,
  },
  addInput: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 10,
    fontSize: 15, fontWeight: '700', color: Colors.text, letterSpacing: 1,
  },
  addBtnRow: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: Colors.muted },
  saveBtn: {
    flex: 2, paddingVertical: 12, borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
