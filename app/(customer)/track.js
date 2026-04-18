import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { StatusBadge } from '../../src/components/StatusBadge';

const TIMELINE = [
  { status: 'pending', label: 'Booking Submitted' },
  { status: 'approved', label: 'Booking Approved' },
  { status: 'assigned', label: 'Driver Assigned' },
  { status: 'accepted', label: 'Driver En Route' },
  { status: 'picked_up', label: 'Cargo Picked Up' },
  { status: 'in_transit', label: 'In Transit' },
  { status: 'delivered', label: 'Delivered' },
  { status: 'completed', label: 'Completed' },
];

const STATUS_ORDER = TIMELINE.map((step) => step.status);

export default function TrackScreen() {
  const { bookingId } = useLocalSearchParams();
  const router = useRouter();
  const [bookings, setBookings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingDone, setRatingDone] = useState(false);
  const pollRef = useRef(null);

  const selectedDriver = tracking?.driver || selected?.driver || null;
  const driverUser = selectedDriver?.user || null;

  const loadBookings = async () => {
    try {
      const response = await api.get('/api/v1/customer/bookings?limit=20');
      const list = response.data || [];
      setBookings(list);

      if (bookingId) {
        const found = list.find((booking) => booking.id === bookingId);
        if (found) setSelected(found);
      } else if (!selected && list.length > 0) {
        const active = list.find((booking) => ['pending', 'approved', 'assigned', 'accepted', 'picked_up', 'in_transit'].includes(booking.status));
        setSelected(active || list[0]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshSelected = async (id) => {
    try {
      const response = await api.get(`/api/v1/customer/bookings/${id}/track`);
      setTracking(response.data?.booking || null);
      setSelected((current) => response.data?.booking || current);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    if (!selected?.id) return undefined;

    refreshSelected(selected.id);
    pollRef.current = setInterval(() => refreshSelected(selected.id), 15000);
    return () => clearInterval(pollRef.current);
  }, [selected?.id]);

  const handleCancel = async () => {
    if (!selected) return;
    if (!['pending', 'approved'].includes(selected.status)) {
      Alert.alert('Cannot Cancel', 'Cancellation is not available at this stage. Contact support if you need help.');
      return;
    }

    Alert.alert('Cancel Booking', 'Cancel this booking?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.post(`/api/v1/customer/bookings/${selected.id}/cancel`, { reason: 'Cancelled from customer app' });
            Alert.alert('Cancelled', 'Your booking has been cancelled.');
            loadBookings();
          } catch (error) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const handleRate = async (stars) => {
    try {
      await api.post(`/api/v1/customer/bookings/${selected.id}/rate`, { rating: stars });
      setRating(stars);
      setRatingDone(true);
      Alert.alert('Thank you', 'Your rating has been submitted.');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const openExternalMaps = async () => {
    const lat = selectedDriver?.current_lat;
    const lng = selectedDriver?.current_lng;
    if (!lat || !lng) {
      Alert.alert('Location unavailable', 'Live coordinates are not available yet.');
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    await Linking.openURL(url);
  };

  const activeBookings = bookings.filter((booking) => ['pending', 'approved', 'assigned', 'accepted', 'picked_up', 'in_transit'].includes(booking.status));
  const currentStatusIndex = selected ? STATUS_ORDER.indexOf(selected.status) : -1;
  const progressPercent = currentStatusIndex >= 0 ? ((currentStatusIndex + 1) / TIMELINE.length) * 100 : 0;

  const latestStatusText = useMemo(() => {
    if (!selected) return '';
    return TIMELINE.find((step) => step.status === selected.status)?.label || selected.status;
  }, [selected]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (activeBookings.length === 0 && !selected) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No Active Bookings</Text>
          <Text style={styles.emptySub}>Create a delivery to track it here.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(customer)/book')}>
            <Text style={styles.emptyBtnText}>Book Now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
              loadBookings();
            }}
            tintColor={colors.primary}
          />
        )}
      >
        <Text style={styles.title}>Track Booking</Text>

        {activeBookings.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={styles.chipRow}>
              {activeBookings.map((booking) => (
                <TouchableOpacity
                  key={booking.id}
                  style={[styles.chip, selected?.id === booking.id && styles.chipActive]}
                  onPress={() => setSelected(booking)}
                >
                  <Text style={[styles.chipText, selected?.id === booking.id && styles.chipTextActive]}>
                    {booking.reference || booking.id}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {selected && (
          <>
            <View style={styles.infoCard}>
              <View style={styles.infoTop}>
                <Text style={styles.ref}>{selected.reference || selected.id}</Text>
                <StatusBadge status={selected.status} />
              </View>

              <Text style={styles.routeText}>{selected.pickup_address}</Text>
              <Text style={styles.routeArrow}>to</Text>
              <Text style={styles.routeText}>{selected.delivery_address}</Text>

              <View style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Trip progress</Text>
                  <Text style={styles.progressValue}>{Math.round(progressPercent)}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                </View>
                <Text style={styles.progressHint}>{latestStatusText}</Text>
              </View>

              <View style={styles.liveFallbackCard}>
                <Text style={styles.liveFallbackTitle}>Live route fallback</Text>
                <Text style={styles.liveFallbackText}>
                  Paid in-app maps are deferred for now. This screen still shows status, driver contact, and live coordinates whenever the driver app sends them.
                </Text>
              </View>

              {driverUser && (
                <View style={styles.driverRow}>
                  <View style={styles.driverAvatar}>
                    <Text style={styles.driverAvatarText}>{(driverUser.full_name || 'D')[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.driverName}>{driverUser.full_name}</Text>
                    <Text style={styles.driverPhone}>{driverUser.phone || 'Phone unavailable'}</Text>
                    {selectedDriver?.current_lat && selectedDriver?.current_lng && (
                      <Text style={styles.driverCoords}>
                        {Number(selectedDriver.current_lat).toFixed(5)}, {Number(selectedDriver.current_lng).toFixed(5)}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity style={styles.mapBtn} onPress={openExternalMaps}>
                    <Text style={styles.mapBtnText}>Open Maps</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <Text style={styles.sectionTitle}>Status Timeline</Text>
            <View style={styles.timeline}>
              {TIMELINE.map((step, index) => {
                const done = index < currentStatusIndex;
                const current = index === currentStatusIndex;

                return (
                  <View key={step.status} style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <View style={[styles.timelineDot, done && styles.dotDone, current && styles.dotCurrent]}>
                        <Text style={styles.timelineDotText}>{done ? 'OK' : current ? 'NOW' : ''}</Text>
                      </View>
                      {index < TIMELINE.length - 1 && <View style={[styles.timelineLine, done && styles.lineDone]} />}
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={[styles.timelineLabel, current && styles.timelineLabelCurrent]}>{step.label}</Text>
                      {current && <Text style={styles.timelineCurrent}>Current stage</Text>}
                    </View>
                  </View>
                );
              })}
            </View>

            {selected.status === 'completed' && !ratingDone && (
              <View style={styles.ratingCard}>
                <Text style={styles.ratingTitle}>Rate your experience</Text>
                <Text style={styles.ratingSub}>The PRD rating window remains available for 48 hours after completion.</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((item) => (
                    <TouchableOpacity key={item} onPress={() => handleRate(item)}>
                      <Text style={[styles.star, rating >= item && styles.starActive]}>*</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {ratingDone && (
              <View style={styles.ratingCard}>
                <Text style={styles.ratingDoneText}>Thanks for rating this trip.</Text>
              </View>
            )}

            {['pending', 'approved'].includes(selected.status) && (
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                <Text style={styles.cancelText}>Cancel Booking</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 16 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 20 },
  emptyBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 },
  emptyBtnText: { color: colors.bg, fontWeight: '800', fontSize: 15 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  chipTextActive: { color: colors.bg },
  infoCard: { backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.border },
  infoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  ref: { fontSize: 15, fontWeight: '800', color: colors.text },
  routeText: { fontSize: 13, color: colors.text, lineHeight: 20 },
  routeArrow: { fontSize: 12, color: colors.textMuted, marginVertical: 6 },
  progressCard: { marginTop: 16, backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}40`, borderWidth: 1, borderRadius: 12, padding: 14 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { color: colors.textMuted, fontSize: 12 },
  progressValue: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 999 },
  progressHint: { marginTop: 8, fontSize: 12, color: colors.text },
  liveFallbackCard: { marginTop: 16, backgroundColor: `${colors.info}12`, borderColor: `${colors.info}35`, borderWidth: 1, borderRadius: 12, padding: 14 },
  liveFallbackTitle: { color: colors.text, fontWeight: '700', marginBottom: 4 },
  liveFallbackText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  driverAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: `${colors.primary}20`, justifyContent: 'center', alignItems: 'center' },
  driverAvatarText: { color: colors.primary, fontWeight: '800' },
  driverName: { color: colors.text, fontWeight: '700', fontSize: 14 },
  driverPhone: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  driverCoords: { color: colors.teal, fontSize: 11, marginTop: 4 },
  mapBtn: { backgroundColor: colors.bgInput, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10 },
  mapBtnText: { color: colors.text, fontWeight: '700', fontSize: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 14 },
  timeline: { marginBottom: 20 },
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineLeft: { alignItems: 'center', width: 40 },
  timelineDot: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.border, backgroundColor: colors.bgCard },
  dotDone: { backgroundColor: colors.success, borderColor: colors.success },
  dotCurrent: { backgroundColor: colors.primary, borderColor: colors.primary },
  timelineDotText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  timelineLine: { width: 2, flex: 1, backgroundColor: colors.border, minHeight: 24 },
  lineDone: { backgroundColor: colors.success },
  timelineContent: { flex: 1, paddingBottom: 18 },
  timelineLabel: { fontSize: 13, color: colors.text, fontWeight: '600' },
  timelineLabelCurrent: { color: colors.primary },
  timelineCurrent: { fontSize: 11, color: colors.primary, marginTop: 2, fontWeight: '600' },
  ratingCard: { backgroundColor: colors.bgCard, borderRadius: 14, padding: 18, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  ratingTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  ratingSub: { fontSize: 12, color: colors.textFaint, marginBottom: 14, textAlign: 'center' },
  starsRow: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 32, color: colors.border },
  starActive: { color: colors.warning },
  ratingDoneText: { color: colors.success, fontSize: 15, fontWeight: '700' },
  cancelBtn: { borderWidth: 1, borderColor: colors.danger, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10 },
  cancelText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
});
