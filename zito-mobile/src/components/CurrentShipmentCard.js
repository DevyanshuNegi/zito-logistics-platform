import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../constants/theme';

/**
 * CurrentShipmentCard - Prominent card showing active shipment with visual progress
 * Reference: Big blue header with 75% progress bar, truck icon, ETA
 */
export const CurrentShipmentCard = ({ booking, onTrack }) => {
  if (!booking) return null;

  // Calculate progress based on status
  const getProgressPercent = (status) => {
    const statusMap = {
      'pending': 10,
      'approved': 20,
      'assigned': 30,
      'accepted': 40,
      'picked_up': 60,
      'in_transit': 80,
      'delivered': 95,
      'completed': 100,
    };
    return statusMap[status] || 0;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'pending': colors.warning,
      'approved': colors.warning,
      'assigned': colors.info,
      'accepted': colors.primary,
      'picked_up': colors.primary,
      'in_transit': colors.primary,
      'delivered': colors.success,
      'completed': colors.success,
    };
    return colorMap[status] || colors.primary;
  };

  const getStatusEmoji = (status) => {
    const emojiMap = {
      'pending': '⏳',
      'approved': '✅',
      'assigned': '🚗',
      'accepted': '🛣️',
      'picked_up': '📦',
      'in_transit': '🚛',
      'delivered': '🏁',
      'completed': '🎉',
    };
    return emojiMap[status] || '📍';
  };

  const progress = getProgressPercent(booking.status);
  const statusColor = getStatusColor(booking.status);

  return (
    <TouchableOpacity 
      style={[s.card, { borderColor: statusColor }]}
      onPress={onTrack}
      activeOpacity={0.85}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerLabel}>Current Shipment</Text>
        <Text style={s.progress}>{progress}%</Text>
      </View>

      {/* Reference */}
      <Text style={s.reference}>{booking.reference}</Text>

      {/* Addresses */}
      <View style={s.addresses}>
        <View style={s.addressRow}>
          <Text style={s.addressIcon}>📍</Text>
          <Text style={s.addressText} numberOfLines={1}>{booking.pickup_address}</Text>
        </View>
        <View style={s.arrow}>
          <Text style={s.arrowText}>↓</Text>
        </View>
        <View style={s.addressRow}>
          <Text style={s.addressIcon}>🏁</Text>
          <Text style={s.addressText} numberOfLines={1}>{booking.delivery_address}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={s.progressBarContainer}>
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: `${progress}%`, backgroundColor: statusColor }]} />
          {/* Truck icon on progress bar */}
          <View style={[s.truckIcon, { left: `${Math.max(5, progress - 8)}%` }]}>
            <Text style={s.truckEmoji}>🚛</Text>
          </View>
        </View>
      </View>

      {/* Status and ETA */}
      <View style={s.statusRow}>
        <View style={s.statusBadge}>
          <Text style={s.statusEmoji}>{getStatusEmoji(booking.status)}</Text>
          <Text style={[s.statusText, { color: statusColor }]}>
            {booking.status.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>
        <Text style={s.eta}>Est. Delivery: {booking.estimated_delivery || 'N/A'}</Text>
      </View>

      {/* CTA */}
      <TouchableOpacity style={[s.cta, { backgroundColor: statusColor + '20', borderColor: statusColor }]} onPress={onTrack}>
        <Text style={[s.ctaText, { color: statusColor }]}>Open Tracking →</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    borderWidth: 2,
    marginHorizontal: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  progress: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  reference: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  addresses: {
    marginBottom: 14,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressIcon: {
    fontSize: 16,
    width: 24,
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  arrow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  arrowText: {
    fontSize: 12,
    color: colors.textFaint,
  },
  progressBarContainer: {
    marginBottom: 14,
    height: 48,
    justifyContent: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  truckIcon: {
    position: 'absolute',
    top: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  truckEmoji: {
    fontSize: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusEmoji: {
    fontSize: 16,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  eta: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  cta: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
