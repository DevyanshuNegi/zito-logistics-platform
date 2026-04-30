// app/(driver)/trips.js
// PRD 5.4 — Accept/reject trips, status updates, POD upload, expense submission
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, TextInput, Modal, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { StatusBadge } from '../../src/components/StatusBadge';

const NEXT = {
  assigned:  { to: 'accepted',   label: 'Accept Trip',    color: colors.success },
  accepted:  { to: 'picked_up',  label: 'Mark Picked Up', color: colors.info    },
  picked_up: { to: 'in_transit', label: 'Start Transit',  color: colors.teal    },
  in_transit:{ to: 'delivered',  label: 'Mark Delivered', color: colors.success },
};

const EXPENSE_TYPES = ['toll', 'fuel', 'loading', 'unloading', 'waiting', 'driver_expense', 'other'];

export default function TripsScreen() {
  const [trips, setTrips]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState('active');
  const [selected, setSelected]   = useState(null);
  const [detailModal, setDetailModal] = useState(false);
  const [expModal, setExpModal]   = useState(false);
  const [expense, setExpense]     = useState({ type: 'toll', amount: '', description: '' });
  const [updating, setUpdating]   = useState(false);
  const [pod, setPod]             = useState(null);

  const fetchTrips = useCallback(async () => {
    try {
      const data = await api.get('/api/v1/driver/trips');
      setTrips(data.data || []);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  const active = trips.filter(t => ['assigned','accepted','picked_up','in_transit'].includes(t.status));
  const history = trips.filter(t => ['delivered','completed','cancelled','rejected'].includes(t.status));
  const displayed = filter === 'active' ? active : history;

  const updateStatus = async (trip, newStatus) => {
    if (newStatus === 'delivered' && !pod) {
      Alert.alert('POD Required', 'Take a Proof of Delivery photo first.'); return;
    }
    if (trip.sos_freeze) { Alert.alert('Booking Frozen', 'SOS active — contact admin.'); return; }
    setUpdating(true);
    try {
      await api.patch(`/api/v1/driver/trips/${trip.id}/status`, { status: newStatus });
      await fetchTrips();
      Alert.alert('Updated ✓', `Status: ${newStatus.replace(/_/g,' ')}`);
      if (selected?.id === trip.id) setDetailModal(false);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setUpdating(false); }
  };

  const rejectTrip = async (trip) => {
    Alert.alert('Reject Trip?', 'This affects your rating.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async () => {
        setUpdating(true);
        try { await api.post(`/api/v1/driver/trips/${trip.id}/reject`); await fetchTrips(); setDetailModal(false); }
        catch (e) { Alert.alert('Error', e.message); }
        finally { setUpdating(false); }
      }},
    ]);
  };

  const takePod = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Camera permission needed'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) setPod(result.assets[0]);
  };

  const submitExpense = async () => {
    if (!expense.amount || !selected) return;
    try {
      await api.post('/api/v1/trip-charges', {
        trip_id: selected.id, charge_type: expense.type,
        amount: parseFloat(expense.amount), description: expense.description,
      });
      setExpModal(false);
      setExpense({ type: 'toll', amount: '', description: '' });
      Alert.alert('Submitted', 'Expense sent for admin approval.');
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const fmt = v => Number(v || 0).toLocaleString();

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>My Trips</Text>
        <View style={s.tabs}>
          {['active','history'].map(f => (
            <TouchableOpacity key={f} style={[s.tab, filter === f && s.tabActive]} onPress={() => setFilter(f)}>
              <Text style={[s.tabText, filter === f && s.tabTextActive]}>{f === 'active' ? `Active (${active.length})` : 'History'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTrips(); }} tintColor={colors.primary} />}>
        {displayed.length === 0 && <Text style={s.empty}>No {filter} trips</Text>}
        {displayed.map(trip => (
          <TouchableOpacity key={trip.id} style={s.card} onPress={() => { setSelected(trip); setPod(null); setDetailModal(true); }}>
            <View style={s.cardTop}>
              <Text style={s.ref}>{trip.reference}</Text>
              <StatusBadge status={trip.status} />
            </View>
            <Text style={s.addr} numberOfLines={1}>📍 {trip.pickup_address}</Text>
            <Text style={s.addr} numberOfLines={1}>🏁 {trip.delivery_address}</Text>
            <View style={s.cardBot}>
              <Text style={s.cargo}>{trip.cargo_type || 'General'} · {trip.cargo_weight_kg || '?'} kg</Text>
              {trip.hire_rate ? <Text style={s.earn}>KES {fmt(trip.hire_rate)}</Text> : null}
            </View>
            {NEXT[trip.status] && (
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: NEXT[trip.status].color }]}
                onPress={() => updateStatus(trip, NEXT[trip.status].to)} disabled={updating}>
                {updating ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.actionText}>{NEXT[trip.status].label}</Text>}
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={detailModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailModal(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHead}>
            <TouchableOpacity onPress={() => setDetailModal(false)}><Text style={s.close}>✕</Text></TouchableOpacity>
            <Text style={s.modalTitle}>Trip Detail</Text>
            <View style={{ width: 32 }} />
          </View>
          {selected && (
            <ScrollView style={s.modalBody}>
              {[
                ['Reference', selected.reference],
                ['Pickup', selected.pickup_address],
                ['Delivery', selected.delivery_address],
                ['Cargo', `${selected.cargo_type || 'General'} · ${selected.cargo_weight_kg || '?'} kg`],
                ['Your Earnings', `KES ${fmt(selected.hire_rate)}`],
              ].map(([l, v]) => (
                <View key={l} style={s.detRow}>
                  <Text style={s.detLabel}>{l}</Text>
                  <Text style={[s.detVal, l === 'Your Earnings' && { color: colors.success }]}>{v}</Text>
                </View>
              ))}
              <View style={s.detRow}><Text style={s.detLabel}>Status</Text><StatusBadge status={selected.status} /></View>

              {/* POD for in_transit */}
              {selected.status === 'in_transit' && (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Proof of Delivery</Text>
                  {pod && <Image source={{ uri: pod.uri }} style={s.podImg} />}
                  <TouchableOpacity style={s.podBtn} onPress={takePod}>
                    <Text style={s.podBtnText}>{pod ? '📷 Retake Photo' : '📷 Take POD Photo'}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {NEXT[selected.status] && (
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: NEXT[selected.status].color, marginTop: 16 }]}
                  onPress={() => updateStatus(selected, NEXT[selected.status].to)} disabled={updating}>
                  {updating ? <ActivityIndicator color="#fff" /> : <Text style={s.actionText}>{NEXT[selected.status].label}</Text>}
                </TouchableOpacity>
              )}
              {selected.status === 'assigned' && (
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.danger, marginTop: 10 }]} onPress={() => rejectTrip(selected)}>
                  <Text style={s.actionText}>Reject Trip</Text>
                </TouchableOpacity>
              )}
              {['accepted','picked_up','in_transit'].includes(selected.status) && (
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, marginTop: 10 }]} onPress={() => setExpModal(true)}>
                  <Text style={[s.actionText, { color: colors.text }]}>+ Submit Expense</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Expense Modal */}
      <Modal visible={expModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setExpModal(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHead}>
            <TouchableOpacity onPress={() => setExpModal(false)}><Text style={s.close}>✕</Text></TouchableOpacity>
            <Text style={s.modalTitle}>Submit Expense</Text>
            <View style={{ width: 32 }} />
          </View>
          <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {EXPENSE_TYPES.map(t => (
                  <TouchableOpacity key={t} style={[s.chip, expense.type === t && s.chipActive]} onPress={() => setExpense(e => ({ ...e, type: t }))}>
                    <Text style={[s.chipText, expense.type === t && { color: colors.primary }]}>{t.replace('_',' ')}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <Text style={s.label}>Amount (KES)</Text>
            <TextInput style={s.input} value={expense.amount} onChangeText={v => setExpense(e => ({ ...e, amount: v }))} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textFaint} />
            <Text style={s.label}>Note (optional)</Text>
            <TextInput style={[s.input, { height: 80 }]} value={expense.description} onChangeText={v => setExpense(e => ({ ...e, description: v }))} multiline placeholder="Description..." placeholderTextColor={colors.textFaint} />
            <TouchableOpacity style={[s.actionBtn, { marginTop: 20 }]} onPress={submitExpense}>
              <Text style={s.actionText}>Submit for Approval</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  header:    { padding: 20, paddingBottom: 0 },
  title:     { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 14 },
  tabs:      { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab:       { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText:   { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabTextActive:{ color: colors.bg },
  list:      { padding: 16, gap: 12, paddingBottom: 32 },
  empty:     { textAlign: 'center', color: colors.textFaint, paddingTop: 60, fontSize: 15 },
  card:      { backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  ref:       { fontSize: 14, fontWeight: '700', color: colors.text },
  addr:      { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
  cardBot:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cargo:     { fontSize: 12, color: colors.textFaint },
  earn:      { fontSize: 14, fontWeight: '700', color: colors.success },
  actionBtn: { backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  actionText:{ color: '#fff', fontWeight: '800', fontSize: 14 },
  modal:     { flex: 1, backgroundColor: colors.bg },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  close:     { color: colors.textMuted, fontSize: 20 },
  modalTitle:{ fontSize: 17, fontWeight: '700', color: colors.text },
  modalBody: { padding: 20 },
  detRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  detLabel:  { fontSize: 13, color: colors.textMuted, flex: 1 },
  detVal:    { fontSize: 13, color: colors.text, flex: 2, textAlign: 'right' },
  section:   { marginTop: 20, padding: 16, backgroundColor: colors.bgInput, borderRadius: 12 },
  sectionTitle:{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 },
  podImg:    { width: '100%', height: 180, borderRadius: 10, marginBottom: 10 },
  podBtn:    { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, alignItems: 'center' },
  podBtnText:{ color: colors.text, fontWeight: '600' },
  label:     { fontSize: 12, color: colors.textMuted, marginBottom: 6, marginTop: 14 },
  input:     { backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, padding: 14, fontSize: 14, marginBottom: 4 },
  chip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  chipActive:{ borderColor: colors.primary },
  chipText:  { color: colors.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
});
