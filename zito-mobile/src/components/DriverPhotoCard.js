import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';

/**
 * DriverPhotoCard Component
 * Shows driver photo on tracking page for trust/safety
 */
export const DriverPhotoCard = ({ driver, rating }) => {
  const getInitial = (name) => (name ? name[0].toUpperCase() : 'D');

  return (
    <View style={s.container}>
      <View style={s.photoSection}>
        <View style={s.photoPlaceholder}>
          <Text style={s.initial}>{getInitial(driver?.full_name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{driver?.full_name || 'Driver'}</Text>
          <View style={s.ratingRow}>
            <Text style={s.stars}>{'⭐'.repeat(Math.round(rating || 0))}</Text>
            <Text style={s.ratingText}>{(rating || 0).toFixed(1)}/5.0</Text>
          </View>
          <Text style={s.status}>✓ Verified Driver</Text>
        </View>
      </View>
      <View style={s.trustIndicators}>
        <View style={s.indicator}>
          <Text style={s.badge}>✓</Text>
          <Text style={s.indicatorText}>Document Verified</Text>
        </View>
        <View style={s.indicator}>
          <Text style={s.badge}>✓</Text>
          <Text style={s.indicatorText}>Insurance Active</Text>
        </View>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  photoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  stars: {
    fontSize: 12,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning,
  },
  status: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 4,
  },
  trustIndicators: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 8,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4CAF50',
  },
  indicatorText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
