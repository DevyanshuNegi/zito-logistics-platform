import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import BrandLockup from '../../src/components/BrandLockup';

const fmt = (value) => Number(value || 0).toLocaleString();

function KpiCard({ label, value, color }) {
  return (
    <View style={[s.kpi, { borderTopColor: color }]}>
      <Text style={[s.kpiVal, { color }]}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const [dash, setDash] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [dashData, bookingData] = await Promise.all([
        api.get('/api/v1/transporter/dashboard').catch(() => ({ data: {} })),
        api.get('/api/v1/transporter/bookings?limit=100').catch(() => ({ data: [] })),
      ]);
      setDash(dashData.data || {});
      setBookings(bookingData.data || []);
    } catch (requestError) {
      console.error(requestError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const completed = bookings.filter((booking) => booking.status === 'completed');
  const active = bookings.filter((booking) =>
    ['assigned', 'accepted', 'picked_up', 'in_transit'].includes(booking.status)
  );
  const revenue = completed.reduce((sum, booking) => sum + parseFloat(booking.customer_rate || 0), 0);
  const hire = completed.reduce((sum, booking) => sum + parseFloat(booking.hire_rate || 0), 0);
  const profit = revenue - hire;

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }>
        <View style={s.headRow}>
          <View>
            <Text style={s.greeting}>Hello, {(user?.full_name || '').split(' ')[0]}</Text>
            <Text style={s.greetSub}>Transporter operations dashboard</Text>
          </View>
          <BrandLockup mode="compact" showDescriptor={false} showCompany={false} />
        </View>

        <View style={s.kpiGrid}>
          <KpiCard label="Total Vehicles" value={dash?.totalVehicles ?? 0} color={colors.info} />
          <KpiCard label="Active Drivers" value={dash?.activeDrivers ?? 0} color={colors.success} />
          <KpiCard label="All Bookings" value={bookings.length} color={colors.primary} />
          <KpiCard label="Active Now" value={active.length} color={colors.warning} />
          <KpiCard label="Completed" value={completed.length} color={colors.success} />
          <KpiCard label="Revenue" value={`KES ${fmt(revenue)}`} color={colors.purple} />
        </View>

        <View style={s.finCard}>
          <Text style={s.finTitle}>Financial summary</Text>
          {[
            { label: 'Customer Revenue', value: `KES ${fmt(revenue)}`, color: colors.primary },
            { label: 'Hire Cost', value: `KES ${fmt(hire)}`, color: colors.text },
            { label: 'Net Profit', value: `KES ${fmt(profit)}`, color: colors.success },
          ].map((row) => (
            <View key={row.label} style={s.finRow}>
              <Text style={s.finLabel}>{row.label}</Text>
              <Text style={[s.finVal, { color: row.color }]}>{row.value}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12 },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.text },
  greetSub: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  kpi: {
    width: '47%',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpiVal: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  kpiLabel: { fontSize: 11, color: colors.textFaint },
  finCard: { backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border },
  finTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 14 },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  finLabel: { fontSize: 13, color: colors.textMuted },
  finVal: { fontSize: 14, fontWeight: '700' },
});
