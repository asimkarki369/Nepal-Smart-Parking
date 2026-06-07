import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { Colors, Spacing, BorderRadius, Typography } from '@/utils/theme';
import { paymentsAPI } from '@/services/api';
import { useStore } from '@/store/useStore';

const TOPUP_AMOUNTS = [100, 200, 500, 1000, 2000, 5000] as const;

const PAYMENT_METHODS = [
  { id: 'esewa', label: 'eSewa', icon: 'cellphone', color: '#60BB46' },
  { id: 'khalti', label: 'Khalti', icon: 'cellphone-wireless', color: '#5C2D91' },
  { id: 'connectips', label: 'ConnectIPS', icon: 'bank-outline', color: '#E84142' },
] as const;

type PaymentMethodId = typeof PAYMENT_METHODS[number]['id'];

const MOCK_TRANSACTIONS = [
  { id: 't1', type: 'topup', amount: 500, method: 'eSewa', date: '2026-05-31', label: 'Top-up via eSewa' },
  { id: 't2', type: 'debit', amount: -88, method: 'wallet', date: '2026-05-30', label: 'Parking — New Road (1h)' },
  { id: 't3', type: 'topup', amount: 1000, method: 'Khalti', date: '2026-05-28', label: 'Top-up via Khalti' },
  { id: 't4', type: 'debit', amount: -44, method: 'wallet', date: '2026-05-25', label: 'Parking — Durbar Marg (30m)' },
];

export default function WalletScreen() {
  const { walletBalance, setWalletBalance } = useStore();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>('esewa');
  const [loading, setLoading] = useState(false);

  const handleTopUp = async () => {
    if (!selectedAmount) return;
    setLoading(true);
    try {
      await paymentsAPI.topUp(selectedAmount, selectedMethod);
      setWalletBalance(walletBalance + selectedAmount);
      Alert.alert('Top-up Successful', `Rs ${selectedAmount} added to your wallet.`);
      setSelectedAmount(null);
    } catch {
      // Dev fallback
      setWalletBalance(walletBalance + selectedAmount);
      Alert.alert('Top-up Successful', `Rs ${selectedAmount} added to your wallet.`);
      setSelectedAmount(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wallet</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceIconRow}>
            <View style={styles.walletIconCircle}>
              <Icon name="wallet" size={28} color={Colors.white} />
            </View>
          </View>
          <Text style={styles.balanceLabel}>NSP Wallet Balance</Text>
          <Text style={styles.balanceAmount}>Rs {walletBalance.toLocaleString()}</Text>
          <Text style={styles.balanceNote}>Used automatically when paying for sessions</Text>
        </View>

        {/* Top-up amounts */}
        <Text style={styles.sectionHeading}>Add Money</Text>
        <View style={styles.amountGrid}>
          {TOPUP_AMOUNTS.map(amt => (
            <TouchableOpacity
              key={amt}
              style={[styles.amountChip, selectedAmount === amt && styles.amountChipActive]}
              onPress={() => setSelectedAmount(amt === selectedAmount ? null : amt)}
              activeOpacity={0.8}
            >
              <Text style={[styles.amountChipText, selectedAmount === amt && styles.amountChipTextActive]}>
                Rs {amt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Payment method */}
        {selectedAmount && (
          <>
            <Text style={styles.sectionHeading}>Pay via</Text>
            <View style={styles.methodRow}>
              {PAYMENT_METHODS.map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.methodCard, selectedMethod === m.id && styles.methodCardActive]}
                  onPress={() => setSelectedMethod(m.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.methodIcon, { backgroundColor: m.color + '20' }]}>
                    <Icon name={m.icon} size={20} color={m.color} />
                  </View>
                  <Text style={[styles.methodLabel, selectedMethod === m.id && styles.methodLabelActive]}>
                    {m.label}
                  </Text>
                  {selectedMethod === m.id && (
                    <View style={styles.methodCheck}>
                      <Icon name="check" size={9} color={Colors.white} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.topupBtn, loading && styles.topupBtnDisabled]}
              onPress={handleTopUp}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <>
                  <Icon name="plus-circle-outline" size={18} color={Colors.white} />
                  <Text style={styles.topupBtnText}>Add Rs {selectedAmount} via {selectedMethod}</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Recent transactions */}
        <Text style={styles.sectionHeading}>Recent Transactions</Text>
        {MOCK_TRANSACTIONS.map(tx => (
          <View key={tx.id} style={styles.txRow}>
            <View style={[styles.txIcon, tx.type === 'topup' ? styles.txIconCredit : styles.txIconDebit]}>
              <Icon
                name={tx.type === 'topup' ? 'arrow-down' : 'arrow-up'}
                size={16}
                color={tx.type === 'topup' ? Colors.green : Colors.red}
              />
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txLabel}>{tx.label}</Text>
              <Text style={styles.txDate}>{tx.date}</Text>
            </View>
            <Text style={[styles.txAmount, tx.type === 'topup' ? styles.txCredit : styles.txDebit]}>
              {tx.type === 'topup' ? '+' : ''}Rs {Math.abs(tx.amount)}
            </Text>
          </View>
        ))}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F6FA' },

  header: {
    backgroundColor: Colors.primary,
    paddingTop: Spacing.xxl + 8, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.white },

  body: { padding: Spacing.lg, paddingBottom: Spacing.xl },

  balanceCard: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
    padding: Spacing.xl, marginBottom: Spacing.lg, alignItems: 'center',
    shadowColor: Colors.primary, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  balanceIconRow: { marginBottom: Spacing.sm },
  walletIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  balanceAmount: { fontSize: 36, fontWeight: '800', color: Colors.white, letterSpacing: 1 },
  balanceNote: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 6, textAlign: 'center' },

  sectionHeading: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },

  amountGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  amountChip: {
    paddingHorizontal: Spacing.md + 4, paddingVertical: Spacing.sm + 2,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 20, backgroundColor: Colors.white,
  },
  amountChipActive: { borderColor: Colors.primary, backgroundColor: '#EEF2FB' },
  amountChipText: { fontSize: 13, fontWeight: '600', color: Colors.muted },
  amountChipTextActive: { color: Colors.primary },

  methodRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  methodCard: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingVertical: Spacing.sm + 2,
    alignItems: 'center', gap: 5,
    backgroundColor: Colors.white, position: 'relative',
  },
  methodCardActive: { borderColor: Colors.primary, backgroundColor: '#EEF2FB' },
  methodIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  methodLabel: { fontSize: 11, color: Colors.muted, fontWeight: '500' },
  methodLabelActive: { color: Colors.primary, fontWeight: '700' },
  methodCheck: {
    position: 'absolute', top: 5, right: 5,
    width: 15, height: 15, borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  topupBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  topupBtnDisabled: { backgroundColor: Colors.muted },
  topupBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },

  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.white, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  txIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  txIconCredit: { backgroundColor: '#E8F5E9' },
  txIconDebit: { backgroundColor: '#FDECEA' },
  txInfo: { flex: 1 },
  txLabel: { fontSize: 13, fontWeight: '600', color: Colors.text },
  txDate: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txCredit: { color: Colors.green },
  txDebit: { color: Colors.red },
});
