import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { colors } from '../constants/theme';

/**
 * Feature #13: Scheduled Bookings
 */
export const ScheduledBookingCard = ({ booking, onModify, onCancel }) => {
  const timeUntilBooking = Math.ceil((new Date(booking.scheduledTime) - new Date()) / (1000 * 60));
  const daysUntil = Math.ceil(timeUntilBooking / (60 * 24));

  return (
    <View style={s.card}>
      <View style={s.header}>
        <View>
          <Text style={s.status}>📅 Scheduled</Text>
          <Text style={s.time}>
            {new Date(booking.scheduledTime).toLocaleDateString()} at {new Date(booking.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <Text style={s.countdown}>{daysUntil}d</Text>
      </View>

      <View style={s.details}>
        <Text style={s.detailLabel}>From:</Text>
        <Text style={s.detailValue} numberOfLines={1}>{booking.from}</Text>
        
        <Text style={s.detailLabel}>To:</Text>
        <Text style={s.detailValue} numberOfLines={1}>{booking.to}</Text>
      </View>

      <View style={s.pricing}>
        <Text style={s.priceLabel}>Estimated Cost:</Text>
        <Text style={s.priceValue}>KES {booking.estimatedCost}</Text>
      </View>

      <View style={s.actions}>
        <TouchableOpacity style={s.modifyBtn} onPress={() => onModify(booking)}>
          <Text style={s.modifyText}>✏️ Modify</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.cancelBtn} onPress={() => onCancel(booking.id)}>
          <Text style={s.cancelText}>✕ Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const RecurringBookingOptions = ({ onSelect }) => {
  const options = [
    { label: 'One-time', value: 'once' },
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' },
  ];

  return (
    <View style={s.optionsContainer}>
      <Text style={s.label}>Booking Frequency</Text>
      <View style={s.optionsRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={s.optionBtn}
            onPress={() => onSelect(opt.value)}>
            <Text style={s.optionText}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  status: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  time: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  countdown: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  details: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 6,
  },
  detailValue: {
    fontSize: 12,
    color: colors.text,
    marginTop: 2,
  },
  pricing: {
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  modifyBtn: {
    flex: 1,
    backgroundColor: colors.primarySoft,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  modifyText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#FF5252' + '20',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelText: {
    color: '#FF5252',
    fontWeight: '700',
    fontSize: 12,
  },
  optionsContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionBtn: {
    flex: 1,
    backgroundColor: colors.bgCard,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
});
