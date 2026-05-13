import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';

/**
 * QuickReorderCard Component
 * Shows a previous booking and allows quick reorder
 */
export const QuickReorderCard = ({ booking, onReorder }) => {
  const getDaysAgo = (date) => {
    const now = new Date();
    const prev = new Date(date);
    const days = Math.floor((now - prev) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return `${Math.floor(days / 7)} weeks ago`;
  };

  const getServiceIcon = (service) => {
    if (service === 'FTL') return '🚛';
    if (service === 'PTL') return '📦';
    if (service === 'Courier') return '📄';
    return '📍';
  };

  return (
    <View style={s.card}>
      <View style={s.header}>
        <View style={s.serviceIcon}>
          <Text style={s.icon}>{getServiceIcon(booking.service_type)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.serviceType}>{booking.service_type || 'Delivery'}</Text>
          <Text style={s.date}>{getDaysAgo(booking.completed_at)}</Text>
        </View>
        <Text style={s.price}>KES {Math.round(booking.total_cost).toLocaleString()}</Text>
      </View>

      <Text style={s.address} numberOfLines={1}>
        From: {booking.pickup_address}
      </Text>
      <Text style={s.address} numberOfLines={1}>
        To: {booking.delivery_address}
      </Text>

      <TouchableOpacity style={s.reorderBtn} onPress={() => onReorder(booking)}>
        <Text style={s.reorderText}>Reorder →</Text>
      </TouchableOpacity>
    </View>
  );
};

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  serviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
  },
  serviceType: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  date: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  address: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 6,
    lineHeight: 16,
  },
  reorderBtn: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 6,
  },
  reorderText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
});
