import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors } from '../constants/theme';

/**
 * Feature #8: Enhanced Booking Flow
 * Smart defaults and quick service selection
 */
export const SmartServiceSelector = ({ onSelect, selected }) => {
  const services = [
    { id: 'courier', name: 'Courier', icon: '📄', price: 'KES 500' },
    { id: 'ptl', name: 'PTL', icon: '📦', price: 'KES 800' },
    { id: 'ftl', name: 'FTL', icon: '🚛', price: 'KES 1500+' },
    { id: 'urgent', name: 'Urgent', icon: '⚡', price: 'KES 2000' },
  ];

  return (
    <View style={s.container}>
      <Text style={s.label}>Service Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.scroll}>
        {services.map((svc) => (
          <TouchableOpacity
            key={svc.id}
            style={[s.serviceCard, selected === svc.id && s.selected]}
            onPress={() => onSelect(svc.id)}>
            <Text style={s.serviceIcon}>{svc.icon}</Text>
            <Text style={s.serviceName}>{svc.name}</Text>
            <Text style={s.servicePrice}>{svc.price}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

/**
 * Real-time Pricing Preview
 */
export const PricingPreview = ({ distance, service, surge }) => {
  const basePrice = { courier: 500, ptl: 800, ftl: 1500, urgent: 2000 }[service] || 500;
  const distanceFee = (distance || 0) * 15; // KES 15 per km
  const surgeMultiplier = surge || 1;
  const total = Math.round((basePrice + distanceFee) * surgeMultiplier);

  return (
    <View style={s.pricingBox}>
      <View style={s.row}>
        <Text style={s.pricingLabel}>Base Fare:</Text>
        <Text style={s.pricingValue}>KES {basePrice}</Text>
      </View>
      <View style={s.row}>
        <Text style={s.pricingLabel}>Distance ({distance}km):</Text>
        <Text style={s.pricingValue}>KES {distanceFee}</Text>
      </View>
      {surge > 1 && (
        <View style={s.row}>
          <Text style={s.pricingLabel}>Surge ({surge}x):</Text>
          <Text style={[s.pricingValue, { color: '#FF9500' }]}>+{Math.round((total - basePrice - distanceFee))}</Text>
        </View>
      )}
      <View style={[s.row, s.total]}>
        <Text style={s.totalLabel}>TOTAL</Text>
        <Text style={s.totalValue}>KES {total}</Text>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  scroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  serviceCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  serviceIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  serviceName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  servicePrice: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  pricingBox: {
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pricingLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  pricingValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  total: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
});
