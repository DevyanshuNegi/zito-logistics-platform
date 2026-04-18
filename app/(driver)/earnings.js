import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';

const fmt = (value) => Number(value || 0).toLocaleString();
const PERIODS = ['daily', 'weekly', 'monthly'];

export default function EarningsScreen() {
  const [earnings, setEarnings] = useState(null);
  const [trips, setTrips] = useState([]);
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [earningsResponse, tripsResponse] = await Promise.all([
        api.get('/api/v1/driver/earnings'),
        api.get('/api/v1/driver/trips'),
      ]);
      setEarnings(earningsResponse.data || {});
      setTrips(tripsResponse.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const completedTrips = useMemo(() => trips.filter((trip) => trip.status === 'completed'), [trips]);

  const filteredTrips = useMemo(() => {
    const now = new Date();
    return completedTrips.filter((trip) => {
      const createdAt = new Date(trip.created_at);
      if (period === 'daily') return createdAt.toDateString() === now.toDateString();
      if (period === 'weekly') return (now - createdAt) <= 7 * 86400000;
      return createdAt.getMonth() === now.getMonth() && createdAt.getFullYear() === now.getFullYear();
    });
  }, [completedTrips, period]);

  const periodTotal = filteredTrips.reduce((sum, trip) => sum + parseFloat(trip.hire_rate || 0), 0);

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
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        )}
      >
        <Text style={styles.title}>Wallet & Earnings</Text>

        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>Total Earnings</Text>
          <Text style={styles.walletAmt}>KES {fmt(earnings?.total_earnings)}</Text>

          <View style={styles.walletRow}>
            <View style={styles.walletStat}>
              <Text style={styles.walletStatLabel}>Approved Expenses</Text>
              <Text style={styles.walletStatValue}>KES {fmt(earnings?.total_expenses)}</Text>
            </View>
            <View style={styles.walletStat}>
              <Text style={styles.walletStatLabel}>Pending Payout</Text>
              <Text style={[styles.walletStatValue, { color: colors.warning }]}>KES {fmt(earnings?.pending_payout)}</Text>
            </View>
          </View>

          <Text style={styles.walletNote}>
            {earnings?.message || 'Wallet visibility is enabled here. Final payout release still follows admin settlement approval.'}
          </Text>
        </View>

        <View style={styles.periodRow}>
          {PERIODS.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.periodBtn, period === item && styles.periodActive]}
              onPress={() => setPeriod(item)}
            >
              <Text style={[styles.periodText, period === item && styles.periodActiveText]}>
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.periodTotal}>
          <Text style={styles.periodTotalLabel}>{period.charAt(0).toUpperCase() + period.slice(1)} Hire Rate</Text>
          <Text style={styles.periodTotalValue}>KES {fmt(periodTotal)}</Text>
          <Text style={styles.periodTotalSub}>{filteredTrips.length} completed trip{filteredTrips.length !== 1 ? 's' : ''}</Text>
        </View>

        <Text style={styles.sectionTitle}>Completed Trip Breakdown</Text>
        {filteredTrips.length === 0 && <Text style={styles.empty}>No completed trips in this period.</Text>}

        {filteredTrips.map((trip) => (
          <View key={trip.id} style={styles.tripRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripRef}>{trip.reference || trip.id}</Text>
              <Text style={styles.tripAddr} numberOfLines={1}>
                {trip.pickup_address} -> {trip.delivery_address}
              </Text>
              <Text style={styles.tripDate}>{new Date(trip.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.tripAmt}>KES {fmt(trip.hire_rate)}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 20 },
  walletCard: { backgroundColor: colors.bgCard, borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: colors.border },
  walletLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
  walletAmt: { fontSize: 32, fontWeight: '900', color: colors.primary, marginBottom: 16 },
  walletRow: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  walletStat: { flex: 1 },
  walletStatLabel: { fontSize: 11, color: colors.textFaint, marginBottom: 2 },
  walletStatValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  walletNote: { fontSize: 11, color: colors.textFaint, lineHeight: 18 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.bgCard, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  periodActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  periodText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  periodActiveText: { color: colors.bg },
  periodTotal: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  periodTotalLabel: { fontSize: 13, color: colors.textMuted },
  periodTotalValue: { fontSize: 28, fontWeight: '800', color: colors.success, marginVertical: 4 },
  periodTotalSub: { fontSize: 12, color: colors.textFaint },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 },
  empty: { color: colors.textFaint, textAlign: 'center', paddingVertical: 20 },
  tripRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  tripRef: { fontSize: 13, fontWeight: '700', color: colors.text },
  tripAddr: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  tripDate: { fontSize: 11, color: colors.textFaint, marginTop: 2 },
  tripAmt: { fontSize: 15, fontWeight: '800', color: colors.success },
});
