import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LinearGradient } from 'react-native';
import { colors } from '../constants/theme';

/**
 * Feature #11: Loyalty/Points System
 */
export const LoyaltyCard = ({ points, pointsNeeded, tier }) => {
  const progress = (points % pointsNeeded) / pointsNeeded;

  const getTierColor = (tierName) => {
    if (tierName === 'Gold') return '#FFD700';
    if (tierName === 'Silver') return '#C0C0C0';
    if (tierName === 'Platinum') return '#E5E4E2';
    return colors.primary;
  };

  return (
    <LinearGradient colors={[getTierColor(tier) + '30', getTierColor(tier) + '10']} style={s.loyaltyCard}>
      <View style={s.tierBadge}>
        <Text style={s.tierEmoji}>👑</Text>
        <Text style={s.tierName}>{tier} Member</Text>
      </View>
      
      <Text style={s.pointsLabel}>Your Points</Text>
      <Text style={s.pointsValue}>{points.toLocaleString()}</Text>
      
      <View style={s.progressContainer}>
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={s.progressText}>{Math.round(progress * 100)}% to next tier</Text>
      </View>

      <TouchableOpacity style={s.redeemBtn}>
        <Text style={s.redeemText}>🎁 Redeem Rewards</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
};

export const PointsEarnedWidget = ({ bookingCost }) => {
  const pointsEarned = Math.round(bookingCost * 0.1); // 10% points
  
  return (
    <View style={s.pointsWidget}>
      <Text style={s.widgetEmoji}>⭐</Text>
      <Text style={s.widgetText}>+{pointsEarned} points</Text>
      <Text style={s.widgetSubtext}>Earned on this booking</Text>
    </View>
  );
};

export const PointsHistory = ({ history }) => {
  return (
    <View>
      {history.map((item, idx) => (
        <View key={idx} style={s.historyItem}>
          <View style={s.historyIconBox}>
            <Text style={s.historyIcon}>{item.type === 'earned' ? '➕' : '➖'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.historyTitle}>{item.description}</Text>
            <Text style={s.historyDate}>{item.date}</Text>
          </View>
          <Text style={[s.historyPoints, item.type === 'earned' ? s.earned : s.spent]}>
            {item.type === 'earned' ? '+' : '-'} {item.points}
          </Text>
        </View>
      ))}
    </View>
  );
};

const s = StyleSheet.create({
  loyaltyCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tierEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  tierName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  pointsLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 4,
  },
  pointsValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 12,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  progressText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  redeemBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  redeemText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
  },
  pointsWidget: {
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  widgetEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  widgetText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  widgetSubtext: {
    fontSize: 10,
    color: colors.textMuted,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyIconBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyIcon: {
    fontSize: 14,
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  historyDate: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  historyPoints: {
    fontSize: 12,
    fontWeight: '700',
  },
  earned: {
    color: '#4CAF50',
  },
  spent: {
    color: colors.warning,
  },
});
