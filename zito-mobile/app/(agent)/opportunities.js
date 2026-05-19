import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import SectionCard from '../../src/components/SectionCard';
import { StatusBadge } from '../../src/components/StatusBadge';
import { colors } from '../../src/constants/theme';
import { readArray } from '../../src/utils/mobile-data';

function formatMoney(value) {
  return `KES ${Number(value || 0).toLocaleString()}`;
}

function prettifyToken(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatRoute(item) {
  return (
    item.routeSummary?.summary ||
    (item.serviceAreaHints || []).join(' -> ') ||
    'Coverage by matched route'
  );
}

function formatRequirements(item) {
  const fleet = item.fleetRequirements || {};
  const stopSummary = item.stopSummary || {};
  const parts = [];

  if (fleet.vehicleType) {
    parts.push(prettifyToken(fleet.vehicleType));
  }
  if (fleet.cargoType) {
    parts.push(prettifyToken(fleet.cargoType));
  }
  if (fleet.cargoWeightKg != null) {
    parts.push(`${Number(fleet.cargoWeightKg).toLocaleString()} kg`);
  }
  if (stopSummary.totalStops) {
    parts.push(
      `${stopSummary.totalStops} stop${stopSummary.totalStops === 1 ? '' : 's'}`,
    );
  }
  if (fleet.estimatedDistanceKm != null) {
    parts.push(`${Number(fleet.estimatedDistanceKm).toLocaleString()} km`);
  }

  return (
    parts.join(' · ') ||
    'Requirements will appear here once dispatch publishes the load.'
  );
}

export default function AgentOpportunitiesScreen() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [bidDrafts, setBidDrafts] = useState({});

  const load = async () => {
    try {
      setError('');
      const payload = await api.get('/api/v1/marketplace/partner/opportunities');
      setOpportunities(readArray(payload, 'opportunities'));
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

  const handleAccept = async (bookingId) => {
    setBusyId(bookingId);
    try {
      setError('');
      await api.post(
        `/api/v1/marketplace/partner/opportunities/${bookingId}/accept`,
        {},
      );
      load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  };

  const handleBid = async (bookingId) => {
    const draft = bidDrafts[bookingId];
    if (!draft || Number(draft) <= 0) {
      setError('Enter a valid bid amount before sending the marketplace response.');
      return;
    }

    setBusyId(bookingId);
    try {
      setError('');
      await api.post(`/api/v1/marketplace/partner/opportunities/${bookingId}/bids`, {
        amount: Number(draft),
        note: 'Submitted from agent mobile desk.',
      });
      load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  };

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
        <Text style={styles.title}>Marketplace Loads</Text>
        <Text style={styles.subtitle}>
          Review matched supply requirements only. Customer details unlock after
          award.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <SectionCard
          title="Live opportunity queue"
          subtitle="Accept fixed-price work immediately or submit a bid for auction and negotiation lanes."
        >
          {opportunities.length === 0 ? (
            <Text style={styles.emptyText}>No matching loads are open right now.</Text>
          ) : (
            opportunities.map((item) => {
              const bookingId = item.bookingId;
              const isFixed = item.pricingModel === 'FIXED_PRICE';
              return (
                <View key={bookingId} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>
                        {item.bookingReference || 'Opportunity'}
                      </Text>
                      <Text style={styles.meta}>
                        {prettifyToken(item.serviceType)} ·{' '}
                        {prettifyToken(item.pricingModel)}
                      </Text>
                    </View>
                    <StatusBadge
                      status={String(item.status || 'open').toLowerCase()}
                    />
                  </View>

                  <Text style={styles.copy}>{formatRoute(item)}</Text>
                  <Text style={styles.copy}>{formatRequirements(item)}</Text>
                  <Text style={styles.copy}>
                    Fixed price: {formatMoney(item.fixedPrice || item.bookingPrice)} ·
                    {' '}Minimum bid:{' '}
                    {item.minimumBid != null ? formatMoney(item.minimumBid) : 'N/A'}
                  </Text>
                  {item.myBid ? (
                    <Text style={styles.copy}>
                      My bid: {formatMoney(item.myBid.amount)} ·{' '}
                      {prettifyToken(item.myBid.status)}
                    </Text>
                  ) : null}

                  {isFixed ? (
                    <TouchableOpacity
                      style={[
                        styles.primaryBtn,
                        busyId === bookingId && styles.primaryBtnDim,
                      ]}
                      disabled={busyId === bookingId}
                      onPress={() => handleAccept(bookingId)}
                    >
                      <Text style={styles.primaryBtnText}>
                        {busyId === bookingId ? 'Accepting...' : 'Accept Fixed Price'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.bidWrap}>
                      <TextInput
                        style={styles.input}
                        value={String(bidDrafts[bookingId] || '')}
                        onChangeText={(value) =>
                          setBidDrafts((current) => ({
                            ...current,
                            [bookingId]: value.replace(/[^0-9.]/g, ''),
                          }))
                        }
                        placeholder="Enter bid amount"
                        placeholderTextColor={colors.textFaint}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        style={[
                          styles.primaryBtn,
                          busyId === bookingId && styles.primaryBtnDim,
                        ]}
                        disabled={busyId === bookingId}
                        onPress={() => handleBid(bookingId)}
                      >
                        <Text style={styles.primaryBtnText}>
                          {busyId === bookingId ? 'Sending...' : 'Submit Bid'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
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
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  card: {
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  meta: { color: colors.textFaint, fontSize: 11, marginTop: 4 },
  copy: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  bidWrap: { gap: 10, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.bgInput,
    color: colors.text,
    padding: 12,
  },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnDim: { opacity: 0.7 },
  primaryBtnText: { color: colors.bg, fontWeight: '800', fontSize: 13 },
});
