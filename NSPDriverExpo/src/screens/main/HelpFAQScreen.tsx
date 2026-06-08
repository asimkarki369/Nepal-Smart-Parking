import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  TouchableOpacity, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Colors, Spacing, BorderRadius } from '@/utils/theme';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FAQItem {
  q: string;
  a: string;
}
interface FAQCategory {
  icon: string;
  title: string;
  items: FAQItem[];
}

const FAQ_DATA: FAQCategory[] = [
  {
    icon: 'car-clock',
    title: 'Parking Sessions',
    items: [
      {
        q: 'How do I start a parking session?',
        a: 'Open the map on the Home screen, tap a parking zone marker, select your vehicle type and duration on the Zone Detail screen, choose your payment method, and tap "Pay". Your session starts immediately after payment.',
      },
      {
        q: 'What happens if I leave before my booked time is up?',
        a: 'Tap "Stop & Pay" on the Home screen. The app will calculate your actual parking time and charge you only for the time you actually used. The difference between your pre-paid amount and the actual cost will be refunded to your wallet.',
      },
      {
        q: 'Can I extend my parking session?',
        a: 'Yes. While a session is active, tap the "+30m" or "+1h" buttons on the Home screen to extend your end time. Additional charges apply based on your vehicle type and zone rate.',
      },
      {
        q: 'What is the maximum parking duration?',
        a: 'The maximum booking is 3 days (72 hours) for standard paid zones. Free zones may have shorter limits — the limit is shown on the Zone Detail screen.',
      },
      {
        q: 'Will I be notified before my session expires?',
        a: 'Yes. You will receive a push notification 10 minutes before your booked end time. Make sure notifications are enabled for NSP in your phone settings.',
      },
    ],
  },
  {
    icon: 'credit-card-outline',
    title: 'Payments & Refunds',
    items: [
      {
        q: 'Which payment methods are accepted?',
        a: 'Nepal Smart Parking supports eSewa, Khalti, and ConnectIPS — the three major digital payment platforms in Nepal. Cash payments are not accepted through the app.',
      },
      {
        q: 'How do refunds work?',
        a: 'If you stop your session early, the refund is calculated automatically and credited to your NSP wallet within a few seconds. From your wallet it can be used for future parking or transferred back to your original payment method.',
      },
      {
        q: 'Where can I download my parking receipt?',
        a: 'After tapping "Stop & Pay" and confirming payment, a receipt screen appears. Tap "Download Receipt" to save the PDF directly to your phone\'s Downloads folder.',
      },
      {
        q: 'What is the service fee?',
        a: 'A 10% service fee is added to the parking fee to cover platform operations. This is shown clearly in the cost breakdown before you confirm payment.',
      },
    ],
  },
  {
    icon: 'car-multiple',
    title: 'Vehicles & Registration',
    items: [
      {
        q: 'How do I add a vehicle?',
        a: 'Go to Profile → My Vehicles → "Add Another Vehicle". Select your vehicle type, enter the plate number, confirm ownership, and tap "Add Vehicle". Your plate will be marked as self-declared until verified by an officer.',
      },
      {
        q: 'How do I switch between vehicles?',
        a: 'Open Profile → My Vehicles. Simply tap the vehicle card you want to use — it will be instantly selected (shown with a purple border and "Selected for parking" badge). No confirmation dialog is needed.',
      },
      {
        q: 'Can I park an EV in a standard zone?',
        a: 'Yes, EVs can park in standard zones at the standard rate for their size (Rs 50/hr for a 4-wheel EV). The discounted EV rate of Rs 15/hr applies only in dedicated EV charging zones.',
      },
      {
        q: 'Can a non-EV park in an EV zone?',
        a: 'No. EV charging zones are restricted to registered electric vehicles only. If you do not have an EV plate registered on your account, the EV zone will be blocked and you will not be able to book a session there.',
      },
      {
        q: 'What does "Self-declared" mean on my plate?',
        a: 'It means your plate number has been entered manually and has not yet been matched against the Department of Transport Management (DoTM) database. A parking officer may ask to physically verify your plate during a session.',
      },
    ],
  },
  {
    icon: 'map-marker-outline',
    title: 'Zones & Pricing',
    items: [
      {
        q: 'What is a BLA (Free) zone?',
        a: 'BLA zones are publicly designated free-parking areas managed by the local municipality. Parking is free but may have a time limit. The limit is shown on the Zone Detail screen.',
      },
      {
        q: 'What are the parking rates?',
        a: 'Standard rates:\n• Bike / Scooter: Rs 25/hr\n• Car / Jeep: Rs 50/hr\n• Electric Vehicle (EV zone): Rs 15/hr\n• Bus / Minibus: Rs 75/hr\n\nRates may vary by zone. The exact rate is always shown before you confirm payment.',
      },
      {
        q: 'How do I find available parking near me?',
        a: 'The map on the Home screen shows all zones with live availability. Green zones have plenty of spaces, orange zones are busy, and red markers mean the zone is full. Tap "Search all parking areas" to search by name or zone code.',
      },
    ],
  },
  {
    icon: 'shield-check-outline',
    title: 'Officer Verification',
    items: [
      {
        q: 'What happens when an officer scans my QR code?',
        a: 'The officer\'s app will show your session details — plate number, vehicle type, zone, and remaining time. If everything matches, no action is needed. If your session has expired or the plate does not match, the officer may issue a fine.',
      },
      {
        q: 'I received a fine but my session was active. What do I do?',
        a: 'Contact our helpdesk at helpdesk@nepalsmsartparking.com with your session receipt. Include your plate number, session ID, and the time of the fine. We will investigate and reverse any incorrectly issued fines within 3 working days.',
      },
    ],
  },
  {
    icon: 'lifebuoy',
    title: 'Account & Technical',
    items: [
      {
        q: 'I forgot my login details. How do I recover my account?',
        a: 'On the Login screen, tap "Forgot details?" and enter your registered National ID number. You will receive an OTP on your registered phone number to regain access.',
      },
      {
        q: 'The app is not showing my location correctly.',
        a: 'Make sure you have granted location permission to NSP in your phone settings (Settings → Apps → NSP → Permissions → Location → Allow). For best accuracy, enable "Precise location" and ensure your GPS is turned on.',
      },
      {
        q: 'The PDF receipt did not download.',
        a: 'When tapping "Download Receipt", Android will ask you to select a folder. Navigate to "Downloads" in the file picker and tap "Use this folder". The PDF will be saved there immediately.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Email helpdesk@nepalsmsartparking.com from your registered phone number with the subject "Account Deletion Request". We will process your request within 7 working days and send a confirmation.',
      },
    ],
  },
];

function FAQAccordion({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(v => !v);
  };

  return (
    <View style={faqStyles.item}>
      <TouchableOpacity style={faqStyles.question} onPress={toggle} activeOpacity={0.7}>
        <Text style={faqStyles.questionText}>{item.q}</Text>
        <Icon
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={open ? Colors.primary : Colors.muted}
        />
      </TouchableOpacity>
      {open && (
        <View style={faqStyles.answer}>
          <Text style={faqStyles.answerText}>{item.a}</Text>
        </View>
      )}
    </View>
  );
}

export default function HelpFAQScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & FAQ</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <View style={styles.introCard}>
          <Icon name="help-circle" size={32} color={Colors.primary} />
          <Text style={styles.introTitle}>How can we help?</Text>
          <Text style={styles.introText}>
            Find answers to common questions below. Tap any question to expand it.
          </Text>
        </View>

        {/* FAQ Categories */}
        {FAQ_DATA.map((cat, ci) => (
          <View key={ci} style={styles.category}>
            <View style={styles.categoryHeader}>
              <View style={styles.catIconBox}>
                <Icon name={cat.icon as any} size={18} color={Colors.primary} />
              </View>
              <Text style={styles.categoryTitle}>{cat.title}</Text>
            </View>
            <View style={styles.categoryCard}>
              {cat.items.map((item, qi) => (
                <React.Fragment key={qi}>
                  <FAQAccordion item={item} />
                  {qi < cat.items.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}

        {/* Contact card */}
        <View style={styles.contactCard}>
          <View style={styles.contactRow}>
            <Icon name="email-outline" size={20} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>Email Support</Text>
              <Text style={styles.contactValue}>helpdesk@nepalsmsartparking.com</Text>
            </View>
          </View>
          <View style={styles.contactDivider} />
          <View style={styles.contactRow}>
            <Icon name="clock-outline" size={20} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>Support Hours</Text>
              <Text style={styles.contactValue}>Sun – Fri, 9:00 AM – 6:00 PM (NST)</Text>
            </View>
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
  introTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  introText:  { fontSize: 13, color: Colors.muted, textAlign: 'center', lineHeight: 20 },

  category: { gap: Spacing.sm - 2 },
  categoryHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  catIconBox: {
    width: 32, height: 32, borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  categoryTitle: { fontSize: 13, fontWeight: '800', color: Colors.text, textTransform: 'uppercase', letterSpacing: 0.5 },

  categoryCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.03, elevation: 1,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: Spacing.lg },

  contactCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.md + 4,
    shadowColor: '#000', shadowOpacity: 0.04, elevation: 2,
    borderWidth: 1, borderColor: Colors.primary + '25',
  },
  contactRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  contactDivider:{ height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm + 2 },
  contactLabel:  { fontSize: 11, color: Colors.muted, fontWeight: '600' },
  contactValue:  { fontSize: 13, color: Colors.text, fontWeight: '600', marginTop: 2 },
});

const faqStyles = StyleSheet.create({
  item: { overflow: 'hidden' },
  question: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  questionText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text, lineHeight: 20 },
  answer: {
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    paddingTop: 2,
    backgroundColor: Colors.light,
  },
  answerText: { fontSize: 13, color: Colors.muted, lineHeight: 21 },
});
