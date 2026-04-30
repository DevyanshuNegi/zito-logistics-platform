import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { BRAND } from '../constants/brand';
import { colors } from '../constants/theme';

export default function BrandLockup({
  mode = 'hero',
  showCompany = true,
  showDescriptor = true,
}) {
  const compact = mode === 'compact';

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Image
        source={compact ? BRAND.assets.wordmark : BRAND.assets.composite}
        style={compact ? styles.wordmark : styles.composite}
        resizeMode="contain"
      />
      {showCompany ? (
        <Text style={[styles.company, compact && styles.companyCompact]}>{BRAND.companyName}</Text>
      ) : null}
      <Text style={[styles.tagline, compact && styles.taglineCompact]}>{BRAND.appTagline}</Text>
      {showDescriptor ? (
        <Text style={[styles.descriptor, compact && styles.descriptorCompact]}>{BRAND.appDescriptor}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  containerCompact: {
    alignItems: 'flex-end',
  },
  composite: {
    width: 260,
    height: 120,
    marginBottom: 12,
  },
  wordmark: {
    width: 96,
    height: 26,
    marginBottom: 6,
  },
  company: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  companyCompact: {
    fontSize: 10,
    marginBottom: 2,
  },
  tagline: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  taglineCompact: {
    fontSize: 11,
    marginBottom: 0,
  },
  descriptor: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  descriptorCompact: {
    fontSize: 10,
    textAlign: 'right',
  },
});
