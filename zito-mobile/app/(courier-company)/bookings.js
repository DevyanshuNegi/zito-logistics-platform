import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { StatusBadge } from '../../src/components/StatusBadge';

function countStops(stops = [], allowed) {
  return stops.filter((stop) => allowed.includes(String(stop.stopType || '').toUpperCase())).length;
}

export default function CourierCompanyBookingsScreen() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await api.get('/api/v1/courier-company/bookings');
      setBookings(data.bookings || []);
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
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        <Text style={s.title}>Load Plans</Text>
        {bookings.length === 0 ? <Text style={s.empty}>No courier-company requests yet.</Text> : null}
        {bookings.map((booking) => (
          <View key={booking.id} style={s.card}>
            <View style={s.cardTop}>
              <Text style={s.ref}>{booking.reference}</Text>
              <StatusBadge status={String(booking.status || '').toLowerCase()} />
            </View>
            <Text style={s.meta}>Service: {booking.serviceType || 'PTL'}</Text>
            <Text style={s.meta}>Loads: {countStops(booking.stops, ['PICKUP', 'LOAD'])} · Unloads: {countStops(booking.stops, ['DELIVERY', 'DROPOFF', 'UNLOAD'])}</Text>
            <Text style={s.meta}>Stops: {(booking.stops || []).length}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  empty: { textAlign: 'center', color: colors.textFaint, marginTop: 40, fontSize: 14 },
  card: { backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  ref: { color: colors.text, fontWeight: '700', fontSize: 14 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
