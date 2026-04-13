// src/components/StatusBadge.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { STATUS_COLORS } from '../constants/theme';

export function StatusBadge({ status }) {
  const cfg = STATUS_COLORS[status] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' };
  return (
    <View style={[s.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[s.text, { color: cfg.color }]}>
        {(status || '').replace(/_/g, ' ').toUpperCase()}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  text:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
});
