import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';

/**
 * SkeletonLoader Component
 * Animated placeholder while loading content
 */
export const SkeletonLoader = ({ width = '100%', height = 20, borderRadius = 4, style }) => {
  return <View style={[s.skeleton, { width, height, borderRadius }, style]} />;
};

/**
 * SkeletonCard - Full card placeholder
 */
export const SkeletonCard = () => {
  return (
    <View style={s.card}>
      <View style={s.row}>
        <SkeletonLoader width={40} height={40} borderRadius={8} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <SkeletonLoader width="70%" height={16} borderRadius={4} style={{ marginBottom: 8 }} />
          <SkeletonLoader width="40%" height={12} borderRadius={4} />
        </View>
      </View>
      <SkeletonLoader width="100%" height={12} borderRadius={4} style={{ marginTop: 12 }} />
      <SkeletonLoader width="85%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
    </View>
  );
};

/**
 * SkeletonDashboard - Multiple skeleton cards
 */
export const SkeletonDashboard = ({ count = 3 }) => {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
};

const s = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.border,
    opacity: 0.5,
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
