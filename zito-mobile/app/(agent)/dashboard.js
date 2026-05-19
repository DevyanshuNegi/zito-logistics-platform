import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import BrandLockup from '../../src/components/BrandLockup';
import KpiTile from '../../src/components/KpiTile';
import SectionCard from '../../src/components/SectionCard';
import { StatusBadge } from '../../src/components/StatusBadge';
import { colors } from '../../src/constants/theme';
import { readArray, readObject } from '../../src/utils/mobile-data';

function prettifyToken(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatLoadMeta(item) {
  const fleet = item.fleetRequirements || {};
  const stopSummary = item.stopSummary || {};
  const parts = [];

  if (fleet.vehicleType) {
    parts.push(prettifyToken(fleet.vehicleType));
  }
  if (fleet.cargoType) {
    parts.push(prettifyToken(fleet.cargoType));
  }
  if (stopSummary.totalStops) {
    parts.push(`${stopSummary.totalStops} stop${stopSummary.totalStops === 1 ? '' : 's'}`);
  }

  return parts.join(' · ') || prettifyToken(item.pricingModel);
}

export default function AgentDashboardScreen() {
  const [profile, setProfile] = useState({});
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      const [profilePayload, opportunityPayload] = await Promise.all([
        api.get('/api/v1/marketplace/partner/profile'),
        api.get('/api/v1/marketplace/partner/opportunities'),
      ]);

      setProfile(readObject(profilePayload, 'partner'));
      setOpportunities(readArray(opportunityPayload, 'opportunities'));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const fixedPriceCount = useMemo(
    () => opportunities.filter((item) => item.pricingModel === 'FIXED_PRICE').length,
    [opportunities],
  );
  const openBidCount = useMemo(
    () => opportunities.filter((item) => item.pricingModel === 'OPEN_BID').length,
    [opportunities],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Agent Supply Desk</Text>
            <Text style={styles.subtitle}>
              Source marketplace supply, monitor approvals, and review
              requirements-only opportunities from mobile.
            </Text>
          </View>
          <BrandLockup mode="compact" showDescriptor={false} showCompany={false} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.kpiGrid}>
          <KpiTile
            label="Open Opportunities"
            value={String(opportunities.length)}
            tone={colors.primary}
          />
          <KpiTile
            label="Fixed Price"
            value={String(fixedPriceCount)}
            tone={colors.info}
          />
          <KpiTile
            label="Open Bid"
            value={String(openBidCount)}
            tone={colors.warning}
          />
          <KpiTile
            label="Coverage Areas"
            value={String((profile.serviceAreas || []).length)}
            tone={colors.success}
          />
        </View>

        <SectionCard
          title="Partner profile"
          subtitle="Marketplace verification, service areas, and commercial setup."
        >
          <View style={styles.profileHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>
                {profile.companyName || 'Agent partner profile'}
              </Text>
              <Text style={styles.meta}>
                Commission {Number(profile.commissionRatePct || 0)}% · Service fee
                {' '}KES {Number(profile.serviceFeeFlat || 0).toLocaleString()}
              </Text>
            </View>
            <StatusBadge
              status={String(profile.verificationStatus || 'pending_review').toLowerCase()}
            />
          </View>
          <Text style={styles.copy}>
            {(profile.serviceAreas || []).length > 0
              ? `Coverage: ${(profile.serviceAreas || []).join(', ')}`
              : 'No service areas have been declared yet.'}
          </Text>
        </SectionCard>

        <SectionCard
          title="Next loads"
          subtitle="The latest matching marketplace requirements available to this agent profile."
        >
          {opportunities.length === 0 ? (
            <Text style={styles.copy}>
              No opportunities are open yet. Refresh after dispatch publishes new
              partner loads.
            </Text>
          ) : (
            opportunities.slice(0, 3).map((item) => (
              <View key={item.bookingId} style={styles.loadCard}>
                <View style={styles.loadTop}>
                  <Text style={styles.loadTitle}>
                    {item.bookingReference || 'Marketplace load'}
                  </Text>
                  <StatusBadge status={String(item.status || 'open').toLowerCase()} />
                </View>
                <Text style={styles.meta}>
                  {item.routeSummary?.summary || 'Coverage by route'}
                </Text>
                <Text style={styles.meta}>{formatLoadMeta(item)}</Text>
              </View>
            ))
          )}
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginTop: 6 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  profileHead: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  profileName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  copy: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  loadCard: {
    marginTop: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
  },
  loadTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  loadTitle: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
});
