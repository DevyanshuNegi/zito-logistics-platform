// app/(customer)/history.js — PRD 5.3 Full booking history with filter
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

export default function HistoryScreen() {
  const [bookings, setBookings]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]         = useState('all');
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(false);

  const load = async (pg = 1, reset = false) => {
    try {
      const data = await api.get(`/customer/bookings?page=${pg}&limit=20`);
      const list = data.data || [];
      setBookings(prev => reset ? list : [...prev, ...list]);
      setHasMore(data.meta?.has_next || false);
      setPage(pg);
    } catch (e) { /* History load error handled by state */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(1, true); }, []);

  const ACTIVE_STATUSES = ['pending','approved','assigned','accepted','picked_up','in_transit'];

  const displayed = bookings.filter(b => {
    if (filter === 'all')       return true;
    if (filter === 'active')    return ACTIVE_STATUSES.includes(b.status);
    if (filter === 'completed') return b.status === 'completed';
    if (filter === 'cancelled') return ['cancelled','rejected'].includes(b.status);
    return true;
  });

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Booking History</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={s.filterRow}>
            {FILTERS.map(f => (
              <TouchableOpacity key={f.key}
                style={[s.filterBtn, filter === f.key && s.filterActive]}
                onPress={() => setFilter(f.key)}>
                <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(1, true); }} tintColor={colors.primary} />}>

        {displayed.length === 0 && (
          <View style={s.empty}><Text style={s.emptyText}>No bookings found</Text></View>
        )}

        {displayed.map(b => (
          <View key={b.id} style={s.card}>
            <View style={s.cardTop}>
              <Text style={s.ref}>{b.reference}</Text>
              <StatusBadge status={b.status} />
            </View>
            <Text style={s.addr} numberOfLines={1}>📍 {b.pickup_address}</Text>
            <Text style={s.addr} numberOfLines={1}>🏁 {b.delivery_address}</Text>
            <View style={s.cardBot}>
              <View>
                <Text style={s.meta}>{(b.vehicle_type || '').replace(/_/g,' ')} · {b.cargo_type || 'General'}</Text>
                <Text style={s.date}>{new Date(b.created_at).toLocaleDateString()}</Text>
              </View>
              {b.customer_rate > 0 && <Text style={s.price}>KES {fmt(b.customer_rate)}</Text>}
            </View>
          </View>
        ))}

        {hasMore && (
          <TouchableOpacity style={s.loadMore} onPress={() => load(page + 1)}>
            <Text style={s.loadMoreText}>Load More</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: colors.bg },
  center:        { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  header:        { padding: 20, paddingBottom: 0 },
  title:         { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 14 },
  filterRow:     { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterBtn:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  filterActive:  { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText:    { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  filterTextActive:{ color: colors.bg },
  list:          { padding: 16, gap: 12, paddingBottom: 100 },
  empty:         { alignItems: 'center', paddingTop: 60 },
  emptyText:     { color: colors.textFaint, fontSize: 15 },
  card:          { backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  ref:           { fontSize: 14, fontWeight: '700', color: colors.text },
  addr:          { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
  cardBot:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  meta:          { fontSize: 12, color: colors.textFaint, textTransform: 'capitalize' },
  date:          { fontSize: 12, color: colors.textFaint, marginTop: 2 },
  price:         { fontSize: 16, fontWeight: '800', color: colors.primary },
  loadMore:      { alignItems: 'center', padding: 16 },
  loadMoreText:  { color: colors.primary, fontWeight: '700' },
});
