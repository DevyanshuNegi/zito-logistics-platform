import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../constants/theme';

/**
 * Feature #10: Wallet & Billing Dashboard
 */
export const WalletCard = ({ balance, currency = 'KES' }) => {
  return (
    <View style={s.walletCard}>
      <Text style={s.walletLabel}>💳 Wallet Balance</Text>
      <Text style={s.walletAmount}>{currency} {balance.toLocaleString()}</Text>
      <View style={s.actions}>
        <TouchableOpacity style={s.actionBtn}>
          <Text style={s.actionBtnText}>Recharge</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, s.secondary]}>
          <Text style={s.actionBtnTextSecondary}>History</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const TransactionItem = ({ transaction }) => {
  const isCredit = transaction.type === 'credit';
  
  return (
    <View style={s.transactionRow}>
      <View style={s.transactionIcon}>
        <Text style={s.icon}>
          {transaction.type === 'booking' ? '📦' : 
           transaction.type === 'refund' ? '↩️' : 
           transaction.type === 'recharge' ? '➕' : '💳'}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.transactionTitle}>{transaction.description}</Text>
        <Text style={s.transactionTime}>{transaction.date}</Text>
      </View>
      <Text style={[s.transactionAmount, isCredit ? s.credit : s.debit]}>
        {isCredit ? '+' : '-'} KES {transaction.amount}
      </Text>
    </View>
  );
};

export const BillingStats = ({ monthlySpent, averagePerBooking, transactionCount }) => {
  return (
    <View style={s.statsContainer}>
      <View style={s.statCard}>
        <Text style={s.statLabel}>Monthly Spent</Text>
        <Text style={s.statValue}>KES {monthlySpent.toLocaleString()}</Text>
      </View>
      <View style={s.statCard}>
        <Text style={s.statLabel}>Avg Per Booking</Text>
        <Text style={s.statValue}>KES {averagePerBooking}</Text>
      </View>
      <View style={s.statCard}>
        <Text style={s.statLabel}>Total Bookings</Text>
        <Text style={s.statValue}>{transactionCount}</Text>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  walletCard: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  walletLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  walletAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: 'white',
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  actionBtnTextSecondary: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 18,
  },
  transactionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  transactionTime: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 12,
    fontWeight: '700',
  },
  credit: {
    color: '#4CAF50',
  },
  debit: {
    color: colors.text,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
});
