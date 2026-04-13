// app/(transporter)/fleet.js — PRD 5.5 Fleet management, doc expiry alerts
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { colors, VEHICLE_TYPES } from '../../src/constants/theme';

const isExpired    = d => d && new Date(d) < new Date();
const isExpiring   = d => { if (!d) return false; const days = (new Date(d) - new Date()) / 86400000; return days >= 0 && days <= 30; };

export default function FleetScreen() {
  const [vehicles, setVehicles]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState({ plate_number: '', make: '', model: '', year: '', vehicle_type: 'pickup', cargo_capacity_kg: '' });

  const load = async () => {
    try { const d = await api.get('/api/v1/transporter/fleet'); setVehicles(d.data || []); }
    catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.plate_number || !form.make || !form.model) { Alert.alert('Required', 'Plate, make and model are required.'); return; }
    setSaving(true);
    try {
      await api.post('/api/v1/transporter/fleet', { ...form, year: parseInt(form.year) || null, cargo_capacity_kg: parseInt(form.cargo_capacity_kg) || null });
      setShowAdd(false);
      setForm({ plate_number: '', make: '', model: '', year: '', vehicle_type: 'pickup', cargo_capacity_kg: '' });
      load();
      Alert.alert('Added ✓', 'Vehicle submitted for admin verification.');
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const docStatus = v => {
    const dates = [v.insurance_expiry, v.ntsa_expiry, v.inspection_expiry];
    if (dates.some(isExpired))  return { label: 'Document expired!', color: colors.danger };
    if (dates.some(isExpiring)) return { label: 'Expiring soon',     color: colors.warning };
    return null;
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Fleet</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={s.addBtnText}>+ Add Vehicle</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>

        {vehicles.length === 0 && <Text style={s.empty}>No vehicles yet. Add your first vehicle.</Text>}

        {vehicles.map(v => {
          const vt  = VEHICLE_TYPES.find(t => t.key === v.vehicle_type);
          const doc = docStatus(v);
          return (
            <View key={v.id} style={s.card}>
              <View style={s.cardTop}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 24 }}>{vt?.icon || '🚚'}</Text>
                  <Text style={s.plate}>{v.plate_number}</Text>
                </View>
                <View style={[s.pill, { backgroundColor: (v.is_verified ? colors.success : colors.warning) + '20', borderColor: v.is_verified ? colors.success : colors.warning }]}>
                  <Text style={[s.pillText, { color: v.is_assignment_blocked ? colors.danger : v.is_verified ? colors.success : colors.warning }]}>
                    {v.is_assignment_blocked ? 'Blocked' : v.is_verified ? 'Verified' : 'Pending'}
                  </Text>
                </View>
              </View>

              <Text style={s.vname}>{v.make} {v.model} {v.year ? `(${v.year})` : ''}</Text>
              <Text style={s.vtype}>{vt?.label || v.vehicle_type} · {v.cargo_capacity_kg ? `${v.cargo_capacity_kg} kg` : 'Capacity not set'}</Text>

              {doc && (
                <View style={[s.docAlert, { backgroundColor: doc.color + '15', borderColor: doc.color }]}>
                  <Text style={[s.docAlertText, { color: doc.color }]}>⚠ {doc.label}</Text>
                </View>
              )}

              <View style={s.docsRow}>
                {[
                  { label: 'Insurance', date: v.insurance_expiry },
                  { label: 'NTSA',      date: v.ntsa_expiry      },
                  { label: 'Inspection',date: v.inspection_expiry },
                ].map(d => {
                  const color = isExpired(d.date) ? colors.danger : isExpiring(d.date) ? colors.warning : colors.textFaint;
                  return (
                    <View key={d.label} style={s.docItem}>
                      <Text style={s.docLabel}>{d.label}</Text>
                      <Text style={[s.docDate, { color }]}>{d.date ? new Date(d.date).toLocaleDateString() : 'Not set'}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHead}>
            <TouchableOpacity onPress={() => setShowAdd(false)}><Text style={s.close}>✕</Text></TouchableOpacity>
            <Text style={s.modalTitle}>Add Vehicle</Text>
            <View style={{ width: 32 }} />
          </View>
          <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
            {[
              { field: 'plate_number',      label: 'Plate Number *', ph: 'KDA 123A',  cap: 'characters' },
              { field: 'make',              label: 'Make *',         ph: 'Toyota',     cap: 'words'      },
              { field: 'model',             label: 'Model *',        ph: 'Hilux',      cap: 'words'      },
              { field: 'year',              label: 'Year',           ph: '2021',       num: true         },
              { field: 'cargo_capacity_kg', label: 'Capacity (kg)',  ph: '1500',       num: true         },
            ].map(f => (
              <View key={f.field}>
                <Text style={s.label}>{f.label}</Text>
                <TextInput style={s.input} value={form[f.field]} onChangeText={v => setForm(p => ({ ...p, [f.field]: v }))}
                  placeholder={f.ph} placeholderTextColor={colors.textFaint}
                  keyboardType={f.num ? 'numeric' : 'default'} autoCapitalize={f.cap || 'sentences'} />
              </View>
            ))}

            <Text style={s.label}>Vehicle Type *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {VEHICLE_TYPES.map(vt => (
                  <TouchableOpacity key={vt.key}
                    style={[s.typeChip, form.vehicle_type === vt.key && s.typeChipActive]}
                    onPress={() => setForm(p => ({ ...p, vehicle_type: vt.key }))}>
                    <Text style={{ fontSize: 22 }}>{vt.icon}</Text>
                    <Text style={[s.typeChipText, form.vehicle_type === vt.key && { color: colors.primary }]}>{vt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={s.note}>Upload vehicle documents (Insurance, NTSA, Inspection) via admin portal for verification before vehicle can be assigned trips.</Text>

            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleAdd} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.bg} /> : <Text style={s.saveBtnText}>Add Vehicle</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bg },
  center:      { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 },
  title:       { fontSize: 22, fontWeight: '800', color: colors.text },
  addBtn:      { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  addBtnText:  { color: colors.bg, fontWeight: '800', fontSize: 13 },
  list:        { padding: 16, gap: 14, paddingBottom: 32 },
  empty:       { textAlign: 'center', color: colors.textFaint, marginTop: 40, fontSize: 14, lineHeight: 22 },
  card:        { backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  plate:       { fontSize: 17, fontWeight: '800', color: colors.text },
  pill:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  pillText:    { fontSize: 11, fontWeight: '700' },
  vname:       { fontSize: 14, color: colors.text, marginBottom: 2 },
  vtype:       { fontSize: 12, color: colors.textMuted, marginBottom: 10 },
  docAlert:    { borderRadius: 8, borderWidth: 1, padding: 8, marginBottom: 10 },
  docAlertText:{ fontSize: 12, fontWeight: '600' },
  docsRow:     { flexDirection: 'row', justifyContent: 'space-between' },
  docItem:     { alignItems: 'center' },
  docLabel:    { fontSize: 10, color: colors.textFaint, marginBottom: 2 },
  docDate:     { fontSize: 11, fontWeight: '600' },
  modal:       { flex: 1, backgroundColor: colors.bg },
  modalHead:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  close:       { color: colors.textMuted, fontSize: 20 },
  modalTitle:  { fontSize: 17, fontWeight: '700', color: colors.text },
  modalBody:   { padding: 20 },
  label:       { fontSize: 12, color: colors.textMuted, marginBottom: 6, marginTop: 14 },
  input:       { backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, padding: 14, fontSize: 14 },
  typeChip:    { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 4 },
  typeChipActive:{ borderColor: colors.primary },
  typeChipText:{ fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  note:        { fontSize: 12, color: colors.textFaint, marginTop: 16, lineHeight: 18 },
  saveBtn:     { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 20 },
  saveBtnText: { color: colors.bg, fontWeight: '800', fontSize: 15 },
});
