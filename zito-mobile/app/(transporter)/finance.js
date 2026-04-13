// app/(transporter)/finance.js — PRD 5.5 Customer rate vs hire rate, profit tracking
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';

const fmt = v => Number(v || 0).toLocaleString();

export default function FinanceScreen() {
  const [bookings, setBookings]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const d = await api.get('/api/v1/transporter/bookings?status=completed&limit=50');
      setBookings(d.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const revenue  = bookings.reduce((s, b) => s + parseFloat(b.customer_rate  || 0), 0);
  const hire     = bookings.reduce((s, b) => s + parseFloat(b.hire_rate      || 0), 0);
  const expenses = bookings.reduce((s, b) => s + parseFloat(b.total_expenses || 0), 0);
  const profit   = revenue - hire - expenses;
  const margin   = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>;

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>

        <Text style={s.title}>Finance</Text>
        <Text style={s.sub}>Customer Rate vs Hire Rate · Profit Tracking</Text>

        <View style={s.summaryCard}>
          <Text style={s.summaryTitle}>All-time Summary ({bookings.length} trips)</Text>
          {[
            { label: 'Customer Revenue', val: `KES ${fmt(revenue)}`,  sub: 'Charged to customers', color: colors.primary },
            { label: 'Hire Cost',        val: `KES ${fmt(hire)}`,     sub: 'Paid to drivers',      color: colors.text    },
            { label: 'Trip Expenses',    val: `KES ${fmt(expenses)}`, sub: 'Toll, fuel, etc',      color: colors.text    },
          ].map(r => (
            <View key={r.label} style={s.finRow}>
              <View>
                <Text style={s.finLabel}>{r.label}</Text>
                <Text style={s.finSub}>{r.sub}</Text>
              </View>
              <Text style={[s.finVal, { color: r.color }]}>{r.val}</Text>
            </View>
          ))}
          <View style={s.divider} />
          <View style={s.finRow}>
            <View>
              <Text style={[s.finLabel, { fontWeight: '700', color: colors.text }]}>Net Profit</Text>
              <Text style={s.finSub}>Revenue − Hire − Expenses</Text>
            </View>
            <Text style={[s.finVal, { color: colors.success, fontWeight: '900', fontSize: 18 }]}>KES {fmt(profit)}</Text>
          </View>
        </View>

        {revenue > 0 && (
          <View style={s.marginCard}>
            <Text style={s.marginLabel}>Profit Margin</Text>
            <Text style={s.marginVal}>{margin}%</Text>
            <View style={s.marginBarBg}>
              <View style={[s.marginBarFill, { width: `${Math.max(0, Math.min(100, parseFloat(margin)))}%` }]} />
            </View>
          </View>
        )}

        <Text style={s.sectionTitle}>Per-Trip Breakdown</Text>
        {bookings.length === 0 && <Text style={s.empty}>No completed bookings yet</Text>}
        {bookings.map(b => {
          const p = parseFloat(b.customer_rate || 0) - parseFloat(b.hire_rate || 0) - parseFloat(b.total_expenses || 0);
          return (
            <View key={b.id} style={s.tripCard}>
              <View style={s.tripTop}>
                <Text style={s.tripRef}>{b.reference}</Text>
                <Text style={[s.tripProfit, { color: p >= 0 ? colors.success : colors.danger }]}>KES {fmt(p)}</Text>
              </View>
              <View style={s.tripRates}>
                <Text style={s.tripRate}>Customer: KES {fmt(b.customer_rate)}</Text>
                <Text style={s.tripRate}>Hire: KES {fmt(b.hire_rate)}</Text>
                {parseFloat(b.total_expenses) > 0 && <Text style={s.tripRate}>Exp: KES {fmt(b.total_expenses)}</Text>}
              </View>
              <Text style={s.tripDate}>{new Date(b.created_at).toLocaleDateString()}</Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: colors.bg },
  center:       { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  content:      { padding: 20, paddingBottom: 40 },
  title:        { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  sub:          { fontSize: 12, color: colors.textMuted, marginBottom: 20 },
  summaryCard:  { backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 },
  finRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  finLabel:     { fontSize: 13, color: colors.text },
  finSub:       { fontSize: 11, color: colors.textFaint, marginTop: 2 },
  finVal:       { fontSize: 14, fontWeight: '700', color: colors.text },
  divider:      { height: 1, backgroundColor: colors.primary + '50', marginVertical: 4 },
  marginCard:   { backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  marginLabel:  { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
  marginVal:    { fontSize: 32, fontWeight: '900', color: colors.success, marginBottom: 12 },
  marginBarBg:  { width: '100%', height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  marginBarFill:{ height: 8, backgroundColor: colors.success, borderRadius: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 },
  empty:        { textAlign: 'center', color: colors.textFaint, paddingTop: 20 },
  tripCard:     { backgroundColor: colors.bgCard, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  tripTop:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  tripRef:      { fontSize: 13, fontWeight: '700', color: colors.text },
  tripProfit:   { fontSize: 14, fontWeight: '800' },
  tripRates:    { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginBottom: 4 },
  tripRate:     { fontSize: 11, color: colors.textFaint },
  tripDate:     { fontSize: 11, color: colors.textFaint },
});
