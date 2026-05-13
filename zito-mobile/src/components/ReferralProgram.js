import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { colors } from '../constants/theme';

/**
 * Feature #12: Referral Program
 */
export const ReferralCard = ({ referralCode, referralLink, earnings }) => {
  const handleCopy = async () => {
    // Implementation: Copy to clipboard using react-native-clipboard
    alert('Referral code copied: ' + referralCode);
  };

  const handleShare = async () => {
    await Share.share({
      message: `Join ZITO Logistics! Use my referral code ${referralCode} and get KES 500 bonus. ${referralLink}`,
      title: 'ZITO Referral',
    });
  };

  return (
    <View style={s.referralCard}>
      <View style={s.referralHeader}>
        <Text style={s.referralTitle}>🎁 Refer & Earn</Text>
        <Text style={s.referralEarnings}>KES {earnings.toLocaleString()}</Text>
      </View>

      <Text style={s.referralLabel}>Your Referral Code</Text>
      <View style={s.codeBox}>
        <Text style={s.codeText}>{referralCode}</Text>
        <TouchableOpacity style={s.copyBtn} onPress={handleCopy}>
          <Text style={s.copyBtnText}>📋</Text>
        </TouchableOpacity>
      </View>

      <View style={s.actions}>
        <TouchableOpacity style={s.shareBtn} onPress={handleShare}>
          <Text style={s.shareBtnText}>Share via WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.shareBtn, s.secondary]}>
          <Text style={s.shareBtnTextSecondary}>Share via SMS</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.referralInfo}>
        📌 Earn KES 500 for each successful referral. No limit!
      </Text>
    </View>
  );
};

export const ReferralStats = ({ referred, completed, pending, earned }) => {
  return (
    <View style={s.statsContainer}>
      <View style={s.statItem}>
        <Text style={s.statEmoji}>👥</Text>
        <Text style={s.statLabel}>Referred</Text>
        <Text style={s.statValue}>{referred}</Text>
      </View>
      <View style={s.statItem}>
        <Text style={s.statEmoji}>✅</Text>
        <Text style={s.statLabel}>Completed</Text>
        <Text style={s.statValue}>{completed}</Text>
      </View>
      <View style={s.statItem}>
        <Text style={s.statEmoji}>⏳</Text>
        <Text style={s.statLabel}>Pending</Text>
        <Text style={s.statValue}>{pending}</Text>
      </View>
      <View style={s.statItem}>
        <Text style={s.statEmoji}>💰</Text>
        <Text style={s.statLabel}>Earned</Text>
        <Text style={s.statValue}>KES {earned}</Text>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  referralCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  referralHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  referralTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  referralEarnings: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  referralLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  codeBox: {
    backgroundColor: colors.bg,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
    flex: 1,
    letterSpacing: 2,
  },
  copyBtn: {
    padding: 8,
  },
  copyBtnText: {
    fontSize: 16,
  },
  actions: {
    gap: 8,
    marginBottom: 12,
  },
  shareBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  shareBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
  },
  secondary: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  shareBtnTextSecondary: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  referralInfo: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
  },
});
