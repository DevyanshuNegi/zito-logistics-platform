// app/(driver)/marketplace.js — PRD 5.8 Marketplace Dashboard
// Available loads, My Bids, Submit offer, Location interest
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { colors, VEHICLE_TYPES } from '../../src/constants/theme';
import { StatusBadge } from '../../src/components/StatusBadge';

const fmt = v => Number(v || 0).toLocaleString();

export default function MarketplaceScreen() {
  const [tab, setTab]             = useState('loads');   // loads | bids
  const [loads, setLoads]         = useState([]);
  const [myBids, setMyBids]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bidModal, setBidModal]   = useState(false);
  const [selected, setSelected]   = useState(null);
  const [bidPrice, setBidPrice]   = useState('');
  const [bidMsg, setBidMsg]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterType, setFilterType] = useState('');

  const loadData = async () => {
    try {
      const [loadsData, bidsData] = await Promise.all([
        api.get('/api/v1/bookings?status=broadcasted&limit=30').catch(() => ({ data: [] })),
        api.get('/api/v1/driver/bids').catch(() => ({ data: [] })),
      ]);
      setLoads(loadsData.data || []);
      setMyBids(bidsData.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { loadData(); }, []);

  const submitBid = async () => {
    if (!bidPrice || !selected) return;
    setSubmitting(true);
    try {
      await api.post('/api/v1/bookings/offers', {
        booking_id: selected.id,
        price: parseFloat(bidPrice),
        message: bidMsg,
      });
      setBidModal(false); setBidPrice(''); setBidMsg('');
      Alert.alert('Bid Submitted ✓', 'Your offer has been sent. Admin will review and notify you.');
      loadData();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSubmitting(false); }
  };

  const acceptRate = async (booking) => {
    Alert.alert('Accept Customer Rate?', `Accept KES ${fmt(booking.customer_rate)} for this load?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Accept', onPress: async () => {
        try {
          await api.post('/api/v1/bookings/offers', { booking_id: booking.id, price: parseFloat(booking.customer_rate), message: 'Accepting offered rate' });
          Alert.alert('Accepted ✓', 'Offer submitted at customer rate.');
          loadData();
        } catch (e) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const filtered = filterType
    ? loads.filter(l => l.vehicle_type === filterType)
    : loads;

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Marketplace</Text>
        <Text style={s.sub}>Available loads · Submit offers</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {[['loads', `Loads (${loads.length})`], ['bids', `My Bids (${myBids.length})`]].map(([key, label]) => (
          <TouchableOpacity key={key} style={[s.tab, tab === key && s.tabActive]} onPress={() => setTab(key)}>
            <Text style={[s.tabText, tab === key && s.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Vehicle filter for loads */}
      {tab === 'loads' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
          <TouchableOpacity style={[s.filterChip, !filterType && s.filterChipActive]} onPress={() => setFilterType('')}>
            <Text style={[s.filterChipText, !filterType && s.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          {VEHICLE_TYPES.map(v => (
            <TouchableOpacity key={v.key} style={[s.filterChip, filterType === v.key && s.filterChipActive]} onPress={() => setFilterType(v.key)}>
              <Text style={s.filterChipText}>{v.icon} {v.label.split(' ')[0]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.primary} />}>

        {/* AVAILABLE LOADS */}
        {tab === 'loads' && (
          <>
            {filtered.length === 0 && <Text style={s.empty}>No available loads right now. Pull to refresh.</Text>}
            {filtered.map(load => {
              const vt = VEHICLE_TYPES.find(v => v.key === load.vehicle_type);
              return (
                <View key={load.id} style={s.card}>
                  <View style={s.cardTop}>
                    <Text style={s.ref}>{load.reference}</Text>
                    <Text style={s.vtype}>{vt?.icon} {vt?.label || load.vehicle_type}</Text>
                  </View>
                  <View style={s.addrRow}>
                    <Text style={s.addrIcon}>📍</Text>
                    <Text style={s.addrText} numberOfLines={1}>{load.pickup_address}</Text>
                  </View>
                  <View style={s.addrRow}>
                    <Text style={s.addrIcon}>🏁</Text>
                    <Text style={s.addrText} numberOfLines={1}>{load.delivery_address}</Text>
                  </View>
                  <View style={s.cardMeta}>
                    <Text style={s.cargoText}>{load.cargo_type || 'General'} · {load.cargo_weight_kg || '?'} kg</Text>
                    {load.customer_rate > 0 && <Text style={s.rateText}>KES {fmt(load.customer_rate)}</Text>}
                  </View>
                  <Text style={s.posted}>Posted {new Date(load.created_at).toLocaleDateString()}</Text>
                  <View style={s.actionsRow}>
                    <TouchableOpacity style={s.acceptBtn} onPress={() => acceptRate(load)}>
                      <Text style={s.acceptBtnText}>✓ Accept Rate</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.bidBtn} onPress={() => { setSelected(load); setBidPrice(''); setBidMsg(''); setBidModal(true); }}>
                      <Text style={s.bidBtnText}>Submit Offer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* MY BIDS */}
        {tab === 'bids' && (
          <>
            {myBids.length === 0 && <Text style={s.empty}>No bids submitted yet. Browse available loads to submit offers.</Text>}
            {myBids.map(bid => (
              <View key={bid.id} style={s.card}>
                <View style={s.cardTop}>
                  <Text style={s.ref}>{bid.booking?.reference || bid.booking_id}</Text>
                  <View style={[s.bidStatus, {
                    backgroundColor: bid.status === 'accepted' ? colors.success + '20' : bid.status === 'rejected' ? colors.danger + '20' : colors.warning + '20',
                    borderColor: bid.status === 'accepted' ? colors.success : bid.status === 'rejected' ? colors.danger : colors.warning,
                  }]}>
                    <Text style={[s.bidStatusText, { color: bid.status === 'accepted' ? colors.success : bid.status === 'rejected' ? colors.danger : colors.warning }]}>
                      {(bid.status || 'pending').toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={s.bidPrice}>Your Offer: KES {fmt(bid.price)}</Text>
                {bid.message && <Text style={s.bidMsg}>"{bid.message}"</Text>}
                <Text style={s.posted}>Submitted {new Date(bid.created_at).toLocaleDateString()}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Bid Modal */}
      <Modal visible={bidModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setBidModal(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHead}>
            <TouchableOpacity onPress={() => setBidModal(false)}><Text style={s.close}>✕</Text></TouchableOpacity>
            <Text style={s.modalTitle}>Submit Offer</Text>
            <View style={{ width: 32 }} />
          </View>
          {selected && (
            <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
              <View style={s.summaryBox}>
                <Text style={s.summaryRef}>{selected.reference}</Text>
                <Text style={s.summaryAddr} numberOfLines={1}>📍 {selected.pickup_address}</Text>
                <Text style={s.summaryAddr} numberOfLines={1}>🏁 {selected.delivery_address}</Text>
                {selected.customer_rate > 0 && (
                  <Text style={s.summaryRate}>Customer rate: KES {fmt(selected.customer_rate)}</Text>
                )}
              </View>
              <Text style={s.label}>Your Price (KES) *</Text>
              <TextInput style={s.input} value={bidPrice} onChangeText={setBidPrice}
                keyboardType="numeric" placeholder="Enter your price" placeholderTextColor={colors.textFaint} autoFocus />
              <Text style={s.label}>Message (optional)</Text>
              <TextInput style={[s.input, { height: 80 }]} value={bidMsg} onChangeText={setBidMsg}
                placeholder="Why should they pick you?" placeholderTextColor={colors.textFaint} multiline />
              <TouchableOpacity style={[s.submitBtn, (!bidPrice || submitting) && { opacity: 0.5 }]} onPress={submitBid} disabled={!bidPrice || submitting}>
                {submitting ? <ActivityIndicator color={colors.bg} /> : <Text style={s.submitBtnText}>Submit Offer →</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: colors.bg },
  center:         { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  header:         { padding: 20, paddingBottom: 8 },
  title:          { fontSize: 22, fontWeight: '800', color: colors.text },
  sub:            { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  tabs:           { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, gap: 8 },
  tab:            { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.bgCard, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  tabActive:      { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText:        { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabTextActive:  { color: colors.bg },
  filterBar:      { maxHeight: 48, marginBottom: 4 },
  filterContent:  { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  filterChip:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  filterChipActive:{ backgroundColor: colors.primary + '20', borderColor: colors.primary },
  filterChipText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  filterChipTextActive:{ color: colors.primary },
  list:           { padding: 16, gap: 12, paddingBottom: 32 },
  empty:          { textAlign: 'center', color: colors.textFaint, paddingTop: 40, fontSize: 14, lineHeight: 22 },
  card:           { backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  ref:            { fontSize: 14, fontWeight: '700', color: colors.text },
  vtype:          { fontSize: 12, color: colors.textMuted },
  addrRow:        { flexDirection: 'row', gap: 8, marginBottom: 4, alignItems: 'center' },
  addrIcon:       { fontSize: 14 },
  addrText:       { flex: 1, fontSize: 13, color: colors.textMuted },
  cardMeta:       { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cargoText:      { fontSize: 12, color: colors.textFaint },
  rateText:       { fontSize: 14, fontWeight: '800', color: colors.primary },
  posted:         { fontSize: 11, color: colors.textFaint, marginTop: 6 },
  actionsRow:     { flexDirection: 'row', gap: 8, marginTop: 12 },
  acceptBtn:      { flex: 1, backgroundColor: colors.success + '20', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.success + '40' },
  acceptBtnText:  { color: colors.success, fontWeight: '700', fontSize: 13 },
  bidBtn:         { flex: 1, backgroundColor: colors.primary, borderRadius: 10, padding: 12, alignItems: 'center' },
  bidBtnText:     { color: colors.bg, fontWeight: '700', fontSize: 13 },
  bidStatus:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  bidStatusText:  { fontSize: 11, fontWeight: '700' },
  bidPrice:       { fontSize: 15, fontWeight: '800', color: colors.primary, marginBottom: 4 },
  bidMsg:         { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginBottom: 4 },
  modal:          { flex: 1, backgroundColor: colors.bg },
  modalHead:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  close:          { color: colors.textMuted, fontSize: 20 },
  modalTitle:     { fontSize: 17, fontWeight: '700', color: colors.text },
  modalBody:      { padding: 20 },
  summaryBox:     { backgroundColor: colors.bgInput, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  summaryRef:     { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 },
  summaryAddr:    { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  summaryRate:    { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 6 },
  label:          { fontSize: 12, color: colors.textMuted, marginBottom: 6, marginTop: 14 },
  input:          { backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, padding: 14, fontSize: 14 },
  submitBtn:      { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  submitBtnText:  { color: colors.bg, fontWeight: '800', fontSize: 15 },
});
