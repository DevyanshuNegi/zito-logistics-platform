import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { BRAND } from '../constants/brand';
import { colors } from '../constants/theme';

export default function BrandLockup({
  mode = 'hero',
  showCompany = true,
  showTagline = true,
  showDescriptor = true,
}) {
  const compact = mode === 'compact';
  const showFullLogo = !compact;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {showFullLogo ? (
        <View style={styles.heroLogoWrap}>
          <Image source={BRAND.assets.appLogo} style={styles.heroLogo} resizeMode="contain" />
        </View>
      ) : (
        <View style={[styles.appRow, compact && styles.appRowCompact]}>
          <View style={styles.appIconFrame}>
            <Image source={BRAND.assets.appIcon} style={styles.appIcon} resizeMode="contain" />
          </View>
          <View style={styles.wordmarkFrame}>
            <Image
              source={BRAND.assets.appWordmark}
              style={compact ? styles.wordmarkCompact : styles.wordmark}
              resizeMode="contain"
            />
          </View>
        </View>
      )}
      {!compact && showCompany ? (
        <View style={styles.companyPanel}>
          <Image source={BRAND.assets.companyLogo} style={styles.companyLogo} resizeMode="contain" />
        </View>
      ) : null}
      {showCompany ? (
        <Text style={[styles.company, compact && styles.companyCompact]}>{BRAND.companyName}</Text>
      ) : null}
      {showTagline ? (
        <Text style={[styles.tagline, compact && styles.taglineCompact]}>{BRAND.appTagline}</Text>
      ) : null}
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
  heroLogoWrap: {
    width: '100%',
    maxWidth: 280,
    marginBottom: 4,
  },
  heroLogo: {
    width: '100%',
    aspectRatio: 1365 / 489,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  appRowCompact: {
    gap: 10,
    marginBottom: 6,
  },
  appIconFrame: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.32)',
    backgroundColor: '#050914',
    padding: 8,
    shadowColor: colors.primary,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  appIcon: {
    width: 36,
    height: 36,
  },
  wordmarkFrame: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.28)',
    backgroundColor: 'rgba(5,9,20,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  wordmark: {
    width: 112,
    height: 24,
  },
  wordmarkCompact: {
    width: 92,
    height: 20,
  },
  companyPanel: {
    width: 246,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.24)',
    backgroundColor: 'rgba(5,9,20,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  companyLogo: {
    width: '100%',
    height: 108,
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
