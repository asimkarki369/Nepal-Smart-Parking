import React from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Colors, Spacing, BorderRadius } from '@/utils/theme';

interface Section {
  icon: string;
  title: string;
  body: string;
}

const SECTIONS: Section[] = [
  {
    icon: 'database-outline',
    title: 'Information We Collect',
    body:
      'We collect your full name, Nepal National ID number, phone number, and vehicle plate number(s) when you register. During parking sessions we record zone code, start/end time, vehicle type, and payment method. Your GPS location is used only to show nearby parking zones and is never stored on our servers.',
  },
  {
    icon: 'cog-outline',
    title: 'How We Use Your Data',
    body:
      'Your data is used to:\n• Create and manage your parking sessions\n• Process payments through eSewa, Khalti, or ConnectIPS\n• Allow parking officers to verify your vehicle at the zone\n• Generate digital receipts and parking history\n• Send session reminders and expiry notifications\n\nWe do not sell or share your personal data with third parties for marketing purposes.',
  },
  {
    icon: 'shield-lock-outline',
    title: 'Data Security',
    body:
      'All data transmitted between the app and our servers is encrypted using TLS 1.3. Payment transactions are handled by certified Nepali payment gateways and we never store your card or wallet credentials. Your National ID is used only for identity verification and is never displayed publicly.',
  },
  {
    icon: 'eye-outline',
    title: 'Officer Access',
    body:
      'Parking officers can view your active session details — including plate number, vehicle type, zone, and session end time — for enforcement purposes only. Officers cannot see your National ID, phone number, or payment information.',
  },
  {
    icon: 'clock-outline',
    title: 'Data Retention',
    body:
      'Active session data is deleted from the live registry when your session ends. Parking history is retained for 12 months to support receipt requests and dispute resolution. You may request deletion of your account and all associated data by contacting our helpdesk.',
  },
  {
    icon: 'bell-outline',
    title: 'Notifications',
    body:
      'We send push notifications for session reminders (10 minutes before expiry), payment confirmations, and refund credits. You can disable notifications in your phone settings at any time, though this may cause you to miss important session alerts.',
  },
  {
    icon: 'account-edit-outline',
    title: 'Your Rights',
    body:
      'Under Nepal's privacy guidelines you have the right to:\n• Access the personal data we hold about you\n• Correct inaccurate information\n• Request deletion of your data\n• Withdraw consent for optional data processing\n\nContact us at helpdesk@nepalsmsartparking.com to exercise any of these rights.',
  },
  {
    icon: 'refresh',
    title: 'Policy Updates',
    body:
      'This policy may be updated as the service evolves. We will notify you via the app when significant changes are made. Continued use of the app after notification constitutes acceptance of the updated policy.',
  },
];

export default function PrivacyPolicyScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <View style={styles.introCard}>
          <Icon name="shield-check" size={32} color={Colors.primary} />
          <Text style={styles.introTitle}>Your Privacy Matters</Text>
          <Text style={styles.introText}>
            Nepal Smart Parking is committed to protecting your personal information.
            This policy explains what data we collect, how we use it, and your rights as a user.
          </Text>
          <Text style={styles.effectiveDate}>Effective date: 1 June 2026</Text>
        </View>

        {/* Sections */}
        {SECTIONS.map((s, i) => (
          <View key={i} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBox}>
                <Icon name={s.icon as any} size={18} color={Colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>{s.title}</Text>
            </View>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}

        {/* Contact */}
        <View style={styles.contactCard}>
          <Icon name="email-outline" size={20} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.contactTitle}>Questions about this policy?</Text>
            <Text style={styles.contactEmail}>helpdesk@nepalsmsartparking.com</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F6FA' },

  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md + 2,
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.white },

  body: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },

  introCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOpacity: 0.04, elevation: 2,
  },
  introTitle:     { fontSize: 18, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  introText:      { fontSize: 13, color: Colors.muted, textAlign: 'center', lineHeight: 20 },
  effectiveDate:  { fontSize: 11, color: Colors.muted, fontWeight: '600' },

  section: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.md + 4,
    shadowColor: '#000', shadowOpacity: 0.03, elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionIconBox: {
    width: 34, height: 34, borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, flex: 1 },
  sectionBody:  { fontSize: 13, color: Colors.muted, lineHeight: 21 },

  contactCard: {
    backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.lg,
    padding: Spacing.md + 4, flexDirection: 'row', alignItems: 'center',
    gap: Spacing.md, borderWidth: 1, borderColor: Colors.primary + '30',
  },
  contactTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  contactEmail: { fontSize: 13, color: Colors.primary, marginTop: 2, fontWeight: '600' },
});
