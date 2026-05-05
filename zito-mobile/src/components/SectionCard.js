import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

export default function SectionCard({ title, subtitle, children, style }) {
  return (
    <View style={[styles.card, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
});
