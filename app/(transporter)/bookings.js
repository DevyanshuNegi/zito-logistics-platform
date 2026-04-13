// app/(transporter)/bookings.js — PRD 5.5 Manage fleet bookings
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { StatusBadge } from '../../src/components/StatusBadge';

const FILTERS = [
  { key: 'all',       label: 'All'       },
  { key: 'active',    label: 'Active'    },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const fmt = v => Number(v || 0).toLocaleString();

export default function BookingsScreen() {
  const [bookings, setBookings]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]         = useState('all');

  const load = async () => {
    try { const d = await api.get('/api/v1/transporter/bookings'); setBookings(d.data || []); }
    catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const ACTIVE = ['assigned','accepted','picked_up','in_transit'];
  const displayed = bookings.filter(b => {
    if (filter === 'all')       return true;
    if (filter === 'active')    return ACTIVE.includes(b.status);
    if (filter === 'completed') return b.status === 'completed';
    if (filter === 'cancelled') return ['cancelled','rejected'].includes(b.status);
    return true;
  });

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}><Text style={s.title}>Fleet Bookings</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f.key} style={[s.filterBtn, filter === f.key && s.filterActive]} onPress={() => setFilter(f.key)}>
            <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>

        {displayed.length === 0 && <Text style={s.empty}>No bookings in this category</Text>}
        {displayed.map(b => (
          <View key={b.id} style={s.card}>
            <View style={s.cardTop}>
              <Text style={s.ref}>{b.reference}</Text>
              <StatusBadge status={b.status} />
            </View>
            <Text style={s.addr} numberOfLines={1}>📍 {b.pickup_address}</Text>
            <Text style={s.addr} numberOfLines={1}>🏁 {b.delivery_address}</Text>
            <View style={s.cardBot}>
              <Text style={s.meta}>{(b.vehicle_type || '').replace(/_/g,' ')} · {b.cargo_type || 'General'}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.customerRate}>KES {fmt(b.customer_rate)}</Text>
                <Text style={s.hireRate}>Hire: KES {fmt(b.hire_rate)}</Text>
              </View>
            </View>
            {b.assignedDriver?.user && (
              <Text style={s.driverLine}>🚗 {b.assignedDriver.user.full_name}</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: colors.bg },
  center:         { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  header:         { padding: 20, paddingBottom: 8 },
  title:          { fontSize: 22, fontWeight: '800', color: colors.text },
  filterBar:      { maxHeight: 52 },
  filterContent:  { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  filterBtn:      { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  filterActive:   { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText:     { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  filterTextActive:{ color: colors.bg },
  list:           { padding: 16, gap: 12, paddingBottom: 32 },
  empty:          { textAlign: 'center', color: colors.textFaint, paddingTop: 40, fontSize: 14 },
  card:           { backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  ref:            { fontSize: 14, fontWeight: '700', color: colors.text },
  addr:           { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
  cardBot:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  meta:           { fontSize: 12, color: colors.textFaint, textTransform: 'capitalize' },
  customerRate:   { fontSize: 14, fontWeight: '800', color: colors.primary },
  hireRate:       { fontSize: 12, color: colors.textFaint, marginTop: 2 },
  driverLine:     { fontSize: 12, color: colors.textMuted, marginTop: 8 },
});
