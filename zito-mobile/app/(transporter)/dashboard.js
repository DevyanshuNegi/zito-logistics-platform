// app/(transporter)/dashboard.js — PRD 5.5 Fleet KPI dashboard
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';

const fmt = v => Number(v || 0).toLocaleString();

function KpiCard({ icon, label, value, color }) {
  return (
    <View style={[s.kpi, { borderTopColor: color }]}>
      <Text style={s.kpiIcon}>{icon}</Text>
      <Text style={[s.kpiVal, { color }]}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { user }    = useAuth();
  const [dash, setDash] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [dData, bData] = await Promise.all([
        api.get('/api/v1/transporter/dashboard').catch(() => ({ data: {} })),
        api.get('/api/v1/transporter/bookings?limit=100').catch(() => ({ data: [] })),
      ]);
      setDash(dData.data || {});
      setBookings(bData.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const completed = bookings.filter(b => b.status === 'completed');
  const active    = bookings.filter(b => ['assigned','accepted','picked_up','in_transit'].includes(b.status));
  const revenue   = completed.reduce((s, b) => s + parseFloat(b.customer_rate || 0), 0);
  const hire      = completed.reduce((s, b) => s + parseFloat(b.hire_rate     || 0), 0);
  const profit    = revenue - hire;

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>;

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>

        <View style={s.headRow}>
          <View>
            <Text style={s.greeting}>Hello, {user?.full_name?.split(' ')[0]} 👋</Text>
            <Text style={s.greetSub}>Transporter Dashboard</Text>
          </View>
          <View style={s.logo}><Text style={s.logoText}>ZITO</Text></View>
        </View>

        <View style={s.kpiGrid}>
          <KpiCard icon="🚚" label="Total Vehicles"  value={dash?.totalVehicles    ?? 0}             color={colors.info}    />
          <KpiCard icon="👤" label="Active Drivers"  value={dash?.activeDrivers    ?? 0}             color={colors.success} />
          <KpiCard icon="📋" label="All Bookings"    value={bookings.length}                          color={colors.primary} />
          <KpiCard icon="⏳" label="Active Now"      value={active.length}                            color={colors.warning} />
          <KpiCard icon="✅" label="Completed"       value={completed.length}                         color={colors.success} />
          <KpiCard icon="💰" label="Revenue"         value={`KES ${fmt(revenue)}`}                    color={colors.primary} />
        </View>

        <View style={s.finCard}>
          <Text style={s.finTitle}>Financial Summary</Text>
          {[
            { label: 'Customer Revenue', val: `KES ${fmt(revenue)}`,  color: colors.primary },
            { label: 'Hire Cost',        val: `KES ${fmt(hire)}`,     color: colors.text    },
            { label: 'Net Profit',       val: `KES ${fmt(profit)}`,   color: colors.success },
          ].map(r => (
            <View key={r.label} style={s.finRow}>
              <Text style={s.finLabel}>{r.label}</Text>
              <Text style={[s.finVal, { color: r.color }]}>{r.val}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: colors.bg },
  center:   { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  content:  { padding: 20, paddingBottom: 40 },
  headRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.text },
  greetSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  logo:     { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontSize: 12, fontWeight: '900', color: colors.bg, letterSpacing: 1 },
  kpiGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  kpi:      { width: '47%', backgroundColor: colors.bgCard, borderRadius: 12, padding: 14, borderTopWidth: 3, borderWidth: 1, borderColor: colors.border },
  kpiIcon:  { fontSize: 20, marginBottom: 6 },
  kpiVal:   { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  kpiLabel: { fontSize: 11, color: colors.textFaint },
  finCard:  { backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border },
  finTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 14 },
  finRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  finLabel: { fontSize: 13, color: colors.textMuted },
  finVal:   { fontSize: 14, fontWeight: '700' },
});
