import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../constants/theme';

/**
 * KPICard Component
 * Displays key performance indicators in the customer dashboard
 * Shows: label, value, trend, and optional status
 */
export const KPICard = ({
  icon,
  label,
  period,
  value,
  trend,
  trendDirection, // 'up', 'down', 'stable'
  customColor,
  status,
}) => {
  const getTrendColor = (direction) => {
    if (direction === 'up') return '#4CAF50'; // Green
    if (direction === 'down') return '#FF5252'; // Red
    return '#2196F3'; // Blue for stable/positive
  };

  const getArrowIcon = (direction) => {
    if (direction === 'up') return '↑';
    if (direction === 'down') return '↓';
    return '→';
  };

  // Create styles inside component to ensure colors are loaded
  const s = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderLeftWidth: 4,
          backgroundColor: colors?.bgCard || '#0c1424',
          padding: 14,
          borderRadius: 12,
          marginBottom: 10,
          borderColor: colors?.border || 'rgba(95,128,255,0.2)',
          borderRightWidth: 1,
          borderTopWidth: 1,
          borderBottomWidth: 1,
        },
        header: {
          marginBottom: 8,
        },
        icon: {
          fontSize: 24,
        },
        label: {
          fontSize: 12,
          fontWeight: '600',
          color: colors?.text || '#f4f8ff',
          marginBottom: 2,
        },
        period: {
          fontSize: 10,
          color: colors?.textMuted || '#9eb0ce',
          marginBottom: 4,
        },
        value: {
          fontSize: 18,
          fontWeight: '700',
          color: colors?.text || '#f4f8ff',
          marginBottom: 6,
        },
        trend: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 4,
        },
        status: {
          fontSize: 9,
          color: colors?.textFaint || '#677a9d',
          marginTop: 4,
        },
      }),
    [colors]
  );

  const borderColor = customColor || colors?.primary || '#0066FF';

  return (
    <View style={[s.card, { borderLeftColor: borderColor }]}>
      <View style={s.header}>
        <Text style={s.icon}>{icon}</Text>
      </View>
      <Text style={s.label}>{label}</Text>
      <Text style={s.period}>{period}</Text>
      <Text style={s.value}>{value}</Text>
      {trend && (
        <Text style={[s.trend, { color: getTrendColor(trendDirection) }]}>
          {getArrowIcon(trendDirection)} {trend}
        </Text>
      )}
      {status && <Text style={s.status}>{status}</Text>}
    </View>
  );
};
