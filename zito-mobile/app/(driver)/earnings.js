// app/(driver)/earnings.js
// PRD 5.4 — Wallet, hire rate earnings, daily/weekly/monthly breakdown
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';

const fmt = v => Number(v || 0).toLocaleString();
const PERIODS = ['daily', 'weekly', 'monthly'];

export default function EarningsScreen() {
  const [earnings, setEarnings] = useState(null);
  const [trips, setTrips]       = useState([]);
  const [period, setPeriod]     = useState('monthly');
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [e, t] = await Promise.all([api.get('/driver/earnings'), api.get('/driver/trips')]);
      setEarnings(e.data || {}); setTrips(t.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const completed = trips.filter(t => t.status === 'completed');
  const now = new Date();
  const filtered = completed.filter(t => {
    const d = new Date(t.created_at);
    if (period === 'daily')  return d.toDateString() === now.toDateString();
    if (period === 'weekly') return (now - d) <= 7 * 86400000;
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const periodTotal = filtered.reduce((s, t) => s + parseFloat(t.hire_rate || 0), 0);

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>;

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>

        <Text style={s.title}>Wallet & Earnings</Text>

        <View style={s.walletCard}>
          <Text style={s.walletLabel}>Total Earnings</Text>
          <Text style={s.walletAmt}>KES {fmt(earnings?.total_earnings)}</Text>
          <View style={s.walletRow}>
            <View style={s.walletStat}>
              <Text style={s.walletStatL}>Approved Expenses</Text>
              <Text style={s.walletStatV}>KES {fmt(earnings?.total_expenses)}</Text>
            </View>
            <View style={s.walletStat}>
              <Text style={s.walletStatL}>Pending Payout</Text>
              <Text style={[s.walletStatV, { color: colors.warning }]}>KES {fmt(earnings?.pending_payout)}</Text>
            </View>
          </View>
          <Text style={s.walletNote}>💡 Payouts released after Admin settlement approval.</Text>
        </View>

        <View style={s.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity key={p} style={[s.periodBtn, period === p && s.periodActive]} onPress={() => setPeriod(p)}>
              <Text style={[s.periodText, period === p && s.periodActiveText]}>{p.charAt(0).toUpperCase()+p.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.periodTotal}>
          <Text style={s.ptLabel}>{period.charAt(0).toUpperCase()+period.slice(1)} Earnings</Text>
          <Text style={s.ptVal}>KES {fmt(periodTotal)}</Text>
          <Text style={s.ptSub}>{filtered.length} completed trip{filtered.length !== 1 ? 's' : ''}</Text>
        </View>

        <Text style={s.sectionTitle}>Trip Breakdown</Text>
        {filtered.length === 0 && <Text style={s.empty}>No trips in this period</Text>}
        {filtered.map(t => (
          <View key={t.id} style={s.tripRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.tripRef}>{t.reference}</Text>
              <Text style={s.tripAddr} numberOfLines={1}>{t.pickup_address} → {t.delivery_address}</Text>
              <Text style={s.tripDate}>{new Date(t.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={s.tripAmt}>KES {fmt(t.hire_rate)}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bg },
  center:      { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  content:     { padding: 20, paddingBottom: 40 },
  title:       { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 20 },
  walletCard:  { backgroundColor: colors.bgCard, borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: colors.border },
  walletLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
  walletAmt:   { fontSize: 32, fontWeight: '900', color: colors.primary, marginBottom: 16 },
  walletRow:   { flexDirection: 'row', gap: 16, marginBottom: 14 },
  walletStat:  { flex: 1 },
  walletStatL: { fontSize: 11, color: colors.textFaint, marginBottom: 2 },
  walletStatV: { fontSize: 16, fontWeight: '700', color: colors.text },
  walletNote:  { fontSize: 11, color: colors.textFaint },
  periodRow:   { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodBtn:   { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.bgCard, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  periodActive:{ backgroundColor: colors.primary, borderColor: colors.primary },
  periodText:  { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  periodActiveText:{ color: colors.bg },
  periodTotal: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  ptLabel:     { fontSize: 13, color: colors.textMuted },
  ptVal:       { fontSize: 28, fontWeight: '800', color: colors.success, marginVertical: 4 },
  ptSub:       { fontSize: 12, color: colors.textFaint },
  sectionTitle:{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 },
  empty:       { color: colors.textFaint, textAlign: 'center', paddingVertical: 20 },
  tripRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  tripRef:     { fontSize: 13, fontWeight: '700', color: colors.text },
  tripAddr:    { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  tripDate:    { fontSize: 11, color: colors.textFaint, marginTop: 2 },
  tripAmt:     { fontSize: 15, fontWeight: '800', color: colors.success },
});
