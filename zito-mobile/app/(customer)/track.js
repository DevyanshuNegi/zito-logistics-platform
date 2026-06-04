// app/(customer)/track.js — PRD 5.3 Live tracking, status timeline, rating, cancel
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, extractErrorMessage } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { CustomerAiSupportSheet } from '../../src/components/CustomerAiSupportSheet';
import { DriverPhotoCard } from '../../src/components/DriverPhotoCard';
import { StatusBadge } from '../../src/components/StatusBadge';
import { SOSButton } from '../../src/components/SOSButton';

const TIMELINE = [
  { status: 'pending',         label: 'Booking Submitted',  icon: '📝' },
  { status: 'approved',        label: 'Booking Approved',   icon: '✅' },
  { status: 'assigned',        label: 'Driver Assigned',    icon: '🚗' },
  { status: 'accepted',        label: 'Driver En Route',    icon: '🛣️' },
  { status: 'picked_up',       label: 'Cargo Picked Up',    icon: '📦' },
  { status: 'in_transit',      label: 'In Transit',         icon: '🚛' },
  { status: 'delivered',       label: 'Delivered',          icon: '🏁' },
  { status: 'completed',       label: 'Completed',          icon: '🎉' },
];
const STATUS_ORDER = TIMELINE.map(t => t.status);
const TRACKING_AI_QUICK_ACTIONS = [
  'Explain this status',
  'Help with ETA',
  'Need support',
  'After delivery',
];

export default function TrackScreen() {
  const { bookingId } = useLocalSearchParams();
  const router = useRouter();
  const [bookings, setBookings]     = useState([]);
  const [selected, setSelected]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rating, setRating]         = useState(0);
  const [ratingDone, setRatingDone] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const pollRef = useRef(null);

  const loadBookings = useCallback(async () => {
    try {
      const data = await api.get('/customer/bookings?limit=20');
      const list = data.data || [];
      setBookings(list);
      setError(null);
      if (bookingId) {
        const found = list.find(b => b.id === bookingId);
        if (found) setSelected(found);
      } else if (!selected?.id && list.length > 0) {
        const active = list.find(b => ['pending','approved','assigned','accepted','picked_up','in_transit'].includes(b.status));
        setSelected(active || list[0]);
      }
    } catch (e) { 
      setError(extractErrorMessage(e));
    }
    finally { setLoading(false); setRefreshing(false); }
  }, [bookingId, selected?.id]);

  const refreshSelected = useCallback(async (id) => {
    try {
      const data = await api.get(`/customer/bookings/${id}`);
      setSelected(data.data || null);
    } catch (_e) { /* Polling error silently handled */ }
  }, []);

  useEffect(() => {
    loadBookings();
    pollRef.current = setInterval(() => {
      if (selected?.id) refreshSelected(selected.id);
    }, 15000);
    return () => clearInterval(pollRef.current);
  }, [loadBookings, refreshSelected, selected?.id]);

  const handleCancel = async () => {
    if (!selected) return;
    if (!['pending', 'approved'].includes(selected.status)) {
      Alert.alert('Cannot Cancel', 'Cancellation not available at this stage. Contact support.'); return;
    }
    Alert.alert('Cancel Booking', 'Cancel this booking?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
        try {
          await api.post(`/customer/bookings/${selected.id}/cancel`, {});
          Alert.alert('Cancelled', 'Your booking has been cancelled.');
          loadBookings();
        } catch (e) { Alert.alert('Error', extractErrorMessage(e)); }
      }},
    ]);
  };

  const handleRate = async (stars) => {
    try {
      await api.post(`/customer/bookings/${selected.id}/rate`, { rating: stars });
      setRating(stars); setRatingDone(true);
      Alert.alert('Thank you!', 'Your rating has been submitted.');
    } catch (e) { Alert.alert('Error', extractErrorMessage(e)); }
  };

  const curIdx = selected ? STATUS_ORDER.indexOf(selected.status) : -1;

  if (loading && !error) return <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  if (error) return (
    <SafeAreaView style={s.root}>
      <View style={s.center}>
        <Text style={s.errorIcon}>⚠️</Text>
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => { setLoading(true); loadBookings(); }}>
          <Text style={s.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const active = bookings.filter(b =>
    ['pending','approved','assigned','accepted','picked_up','in_transit'].includes(b.status)
  );

  if (active.length === 0 && !selected) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🛰️</Text>
          <Text style={s.emptyTitle}>No Active Bookings</Text>
          <Text style={s.emptySub}>Book a delivery to track it here</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/(customer)/book')}>
            <Text style={s.emptyBtnText}>Book Now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadBookings(); }} tintColor={colors.primary} />}>

        <Text style={s.title}>Track Booking</Text>

        {/* Booking selector chips */}
        {active.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {active.map(b => (
                <TouchableOpacity key={b.id}
                  style={[s.chip, selected?.id === b.id && s.chipActive]}
                  onPress={() => setSelected(b)}>
                  <Text style={[s.chipText, selected?.id === b.id && s.chipTextActive]}>{b.reference}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {selected && (
          <>
            {/* Info card */}
            <View style={s.infoCard}>
              <View style={s.infoTop}>
                <Text style={s.ref}>{selected.reference}</Text>
                <StatusBadge status={selected.status} />
              </View>
              <View style={s.addrRow}><Text style={s.addrIcon}>📍</Text><Text style={s.addrText} numberOfLines={2}>{selected.pickup_address}</Text></View>
              <View style={s.addrRow}><Text style={s.addrIcon}>🏁</Text><Text style={s.addrText} numberOfLines={2}>{selected.delivery_address}</Text></View>
              {selected.assignedDriver?.user && (
                <DriverPhotoCard
                  driver={selected.assignedDriver.user}
                  rating={Number(selected.assignedDriver.avg_rating || 0)}
                />
              )}

              {/* Emergency SOS Button */}
              {!['completed', 'cancelled'].includes(selected.status) && (
                <View style={s.emergencySection}>
                  <SOSButton
                    bookingId={selected.id}
                    onSuccess={() => {
                      // Refresh booking data after SOS
                      refreshSelected(selected.id);
                    }}
                  />
                </View>
              )}
            </View>

            {/* Zito Assistant Card */}
            <TouchableOpacity style={s.helperCard} onPress={() => setShowAssistant(true)}>
              <Text style={s.helperLabel}>Zito Assistant</Text>
              <Text style={s.helperTitle}>Ask about status, ETA, support, or what happens next in this trip.</Text>
            </TouchableOpacity>

            {/* Status Timeline */}
            <Text style={s.sectionTitle}>Trip Progress</Text>
            <View style={s.timeline}>
              {TIMELINE.map((step, i) => {
                const done = i < curIdx, current = i === curIdx, future = i > curIdx;
                return (
                  <View key={step.status} style={s.tlRow}>
                    <View style={s.tlLeft}>
                      <View style={[s.tlDot, done && s.dotDone, current && s.dotCurrent, future && s.dotFuture]}>
                        <Text style={s.tlDotText}>{done ? '✓' : current ? '●' : '○'}</Text>
                      </View>
                      {i < TIMELINE.length - 1 && <View style={[s.tlLine, done && s.lineDone]} />}
                    </View>
                    <View style={s.tlContent}>
                      <Text style={[s.tlLabel, future && s.tlLabelFuture]}>{step.icon} {step.label}</Text>
                      {current && <Text style={s.tlCurrent}>Current status</Text>}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Rating */}
            {selected.status === 'completed' && !ratingDone && (
              <View style={s.ratingCard}>
                <Text style={s.ratingTitle}>Rate your experience</Text>
                <Text style={s.ratingSub}>Rating window: 48 hours after completion</Text>
                <View style={s.starsRow}>
                  {[1,2,3,4,5].map(n => (
                    <TouchableOpacity key={n} onPress={() => handleRate(n)}>
                      <Text style={[s.star, rating >= n && s.starActive]}>★</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            {ratingDone && (
              <View style={s.ratingCard}>
                <Text style={{ color: colors.success, fontSize: 15, fontWeight: '600' }}>{'⭐'.repeat(rating)} Thank you!</Text>
              </View>
            )}

            {/* Cancel */}
            {['pending','approved'].includes(selected.status) && (
              <TouchableOpacity style={s.cancelBtn} onPress={handleCancel}>
                <Text style={s.cancelText}>Cancel Booking</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      <CustomerAiSupportSheet
        visible={showAssistant}
        onClose={() => setShowAssistant(false)}
        screenContext="CUSTOMER_TRACKING"
        title="Tracking help"
        description="Get customer help for this trip status, ETA questions, support, or next-step guidance."
        quickActions={TRACKING_AI_QUICK_ACTIONS}
        bookingOptions={selected ? [{ id: selected.id, reference: selected.reference }] : active.map((booking) => ({
          id: booking.id,
          reference: booking.reference,
        }))}
        defaultBookingId={selected?.id}
        placeholder="Ask about this trip status, ETA, delivery update, or when to contact support."
        helpText="Zito Assistant explains customer procedures and can help you decide when to open support."
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bg },
  center:      { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  content:     { padding: 20, paddingBottom: 100 },
  title:       { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 20, marginTop: 4 },
  helperCard:  {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primarySoft,
    padding: 16,
    marginBottom: 16,
  },
  helperLabel: { fontSize: 11, fontWeight: '800', color: colors.primary, letterSpacing: 1 },
  helperTitle: { fontSize: 14, lineHeight: 20, color: colors.text, marginTop: 6, fontWeight: '700' },
  empty:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon:   { fontSize: 56, marginBottom: 16 },
  emptyTitle:  { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptySub:    { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 20 },
  emptyBtn:    { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 },
  emptyBtnText:{ color: colors.bg, fontWeight: '800', fontSize: 15 },
  chip:        { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  chipActive:  { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText:    { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  chipTextActive:{ color: colors.bg },
  infoCard:    { backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.border },
  infoTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  ref:         { fontSize: 15, fontWeight: '800', color: colors.text },
  addrRow:     { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' },
  addrIcon:    { fontSize: 16, marginTop: 1 },
  addrText:    { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  driverRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  driverAvatar:{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  driverAvatarText:{ fontSize: 16, fontWeight: '700', color: colors.primary },
  driverName:  { fontSize: 14, fontWeight: '700', color: colors.text },
  driverPhone: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  driverRating:{ fontSize: 14, color: colors.warning },
  emergencySection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
  },
  sectionTitle:{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 14 },
  timeline:    { marginBottom: 20 },
  tlRow:       { flexDirection: 'row', gap: 12 },
  tlLeft:      { alignItems: 'center', width: 30 },
  tlDot:       { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.border, backgroundColor: colors.bgCard },
  dotDone:     { backgroundColor: colors.success, borderColor: colors.success },
  dotCurrent:  { backgroundColor: colors.primary, borderColor: colors.primary },
  dotFuture:   { opacity: 0.3 },
  tlDotText:   { fontSize: 11, fontWeight: '800', color: '#fff' },
  tlLine:      { width: 2, flex: 1, backgroundColor: colors.border, minHeight: 24 },
  lineDone:    { backgroundColor: colors.success },
  tlContent:   { flex: 1, paddingBottom: 18 },
  tlLabel:     { fontSize: 13, color: colors.text, fontWeight: '600' },
  tlLabelFuture:{ color: colors.textFaint },
  tlCurrent:   { fontSize: 11, color: colors.primary, marginTop: 2, fontWeight: '600' },
  ratingCard:  { backgroundColor: colors.bgCard, borderRadius: 14, padding: 18, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  ratingTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  ratingSub:   { fontSize: 12, color: colors.textFaint, marginBottom: 14 },
  starsRow:    { flexDirection: 'row', gap: 8 },
  star:        { fontSize: 36, color: colors.border },
  starActive:  { color: colors.warning },
  cancelBtn:   { borderWidth: 1, borderColor: colors.danger, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10 },
  cancelText:  { color: colors.danger, fontWeight: '700', fontSize: 15 },
  errorIcon:   { fontSize: 56, marginBottom: 16 },
  errorText:   { fontSize: 15, color: colors.text, textAlign: 'center', marginBottom: 20, paddingHorizontal: 20 },
  retryBtn:    { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 },
  retryText:   { color: colors.bg, fontWeight: '800', fontSize: 15 },
});
