import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';

function KpiCard({ label, value, tone }) {
  return (
    <View style={[s.kpi, { borderColor: tone || colors.border }]}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiValue, { color: tone || colors.text }]}>{value}</Text>
    </View>
  );
}

export default function CourierCompanyDashboard() {
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [bookingData, vehicleData] = await Promise.all([
        api.get('/api/v1/courier-company/bookings'),
        api.get('/api/v1/fleet'),
      ]);
      setBookings(bookingData.bookings || []);
      setVehicles(Array.isArray(vehicleData) ? vehicleData : []);
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

  const active = useMemo(
    () => bookings.filter((item) => !['COMPLETED', 'CANCELLED'].includes(String(item.status || ''))).length,
    [bookings],
  );
  const multiStop = useMemo(
    () => bookings.filter((item) => (item.stops || []).length > 2).length,
    [bookings],
  );

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        <Text style={s.title}>Courier Company</Text>
        <Text style={s.subtitle}>Manage county-to-county movements, owned fleet, and CFA-linked execution from one mobile workspace.</Text>

        <View style={s.kpiGrid}>
          <KpiCard label="Load Plans" value={String(bookings.length)} tone={colors.primary} />
          <KpiCard label="Active" value={String(active)} tone={colors.info} />
          <KpiCard label="Owned Fleet" value={String(vehicles.length)} tone={colors.success} />
          <KpiCard label="Multi-stop" value={String(multiStop)} tone={colors.warning} />
        </View>

        <View style={s.note}>
          <Text style={s.noteTitle}>Expansion Scope</Text>
          <Text style={s.noteText}>
            Courier-company mode supports owned vehicles, Zito CFA network execution, and multi-load or multi-unload distribution flows. Platform-fee billing is still a finance follow-up.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, gap: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpi: { width: '47%', backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, padding: 16 },
  kpiLabel: { color: colors.textMuted, fontSize: 12 },
  kpiValue: { fontSize: 22, fontWeight: '800', marginTop: 8 },
  note: { backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 },
  noteTitle: { color: colors.text, fontWeight: '700', marginBottom: 8 },
  noteText: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
});
