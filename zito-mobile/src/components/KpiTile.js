import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

export default function KpiTile({ label, value, tone = colors.primary, caption }) {
  return (
    <View style={[styles.card, { borderTopColor: tone }]}>
      <Text style={[styles.value, { color: tone }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '47%',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  label: {
    fontSize: 11,
    color: colors.text,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  caption: {
    marginTop: 8,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
});
