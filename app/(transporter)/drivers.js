// app/(transporter)/drivers.js — PRD 5.5 Driver management
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';

export default function DriversScreen() {
  const [drivers, setDrivers]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState({ full_name: '', email: '', phone: '', password: '', license_number: '', license_class: '' });

  const load = async () => {
    try { const d = await api.get('/api/v1/transporter/drivers'); setDrivers(d.data || []); }
    catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.full_name || !form.email || !form.phone || !form.password || !form.license_number) {
      Alert.alert('Required', 'All fields except license class are required.'); return;
    }
    setSaving(true);
    try {
      await api.post('/api/v1/transporter/drivers', form);
      setShowAdd(false);
      setForm({ full_name: '', email: '', phone: '', password: '', license_number: '', license_class: '' });
      load();
      Alert.alert('Invited ✓', 'Driver created. Pending admin compliance review.');
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Drivers</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={s.addBtnText}>+ Invite Driver</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>

        {drivers.length === 0 && <Text style={s.empty}>No drivers yet. Invite your first driver.</Text>}

        {drivers.map(d => {
          const u = d.user || d;
          const dr = d.driverProfile || d;
          const compliance = dr.compliance_status || u.compliance_status || 'pending';
          const cc = compliance === 'approved' ? colors.success : compliance === 'rejected' ? colors.danger : colors.warning;
          return (
            <View key={d.id || u.id} style={s.card}>
              <View style={s.cardTop}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={s.avatar}><Text style={s.avatarText}>{(u.full_name || 'D')[0]}</Text></View>
                  <View>
                    <Text style={s.dname}>{u.full_name}</Text>
                    <Text style={s.dcontact}>{u.phone}</Text>
                  </View>
                </View>
                <View style={[s.pill, { backgroundColor: cc + '20', borderColor: cc }]}>
                  <Text style={[s.pillText, { color: cc }]}>{compliance.replace('_',' ')}</Text>
                </View>
              </View>
              <View style={s.statsRow}>
                {[
                  { val: `⭐ ${Number(dr.avg_rating || 0).toFixed(1)}`, label: 'Rating'    },
                  { val: dr.total_trips || 0,                           label: 'Trips'     },
                  { val: dr.is_available ? '✅' : '🔴',                 label: 'Available' },
                  { val: dr.can_receive_assignments ? '✅' : '🔴',      label: 'Can Assign'},
                ].map(({ val, label }) => (
                  <View key={label} style={{ alignItems: 'center' }}>
                    <Text style={s.statVal}>{val}</Text>
                    <Text style={s.statLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHead}>
            <TouchableOpacity onPress={() => setShowAdd(false)}><Text style={s.close}>✕</Text></TouchableOpacity>
            <Text style={s.modalTitle}>Invite Driver</Text>
            <View style={{ width: 32 }} />
          </View>
          <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
            {[
              { field: 'full_name',      label: 'Full Name *',       ph: 'John Doe',       cap: 'words'         },
              { field: 'email',          label: 'Email *',           ph: 'john@email.com', cap: 'none', email: true },
              { field: 'phone',          label: 'Phone * (E.164)',   ph: '+254712345678',  cap: 'none', phone: true },
              { field: 'password',       label: 'Temp Password *',   ph: 'Min 6 chars',    secure: true          },
              { field: 'license_number', label: 'License Number *',  ph: 'DL123456',       cap: 'characters'    },
              { field: 'license_class',  label: 'License Class',     ph: 'BCE',            cap: 'characters'    },
            ].map(f => (
              <View key={f.field}>
                <Text style={s.label}>{f.label}</Text>
                <TextInput style={s.input} value={form[f.field]} onChangeText={v => setForm(p => ({ ...p, [f.field]: v }))}
                  placeholder={f.ph} placeholderTextColor={colors.textFaint}
                  keyboardType={f.email ? 'email-address' : f.phone ? 'phone-pad' : 'default'}
                  autoCapitalize={f.cap || 'sentences'} secureTextEntry={!!f.secure} />
              </View>
            ))}
            <Text style={s.note}>Driver must complete KRA PIN, police clearance, medical certificate, and sign the driver oath for admin approval before receiving trips.</Text>
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleAdd} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.bg} /> : <Text style={s.saveBtnText}>Send Invite</Text>}
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
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 },
  title:     { fontSize: 22, fontWeight: '800', color: colors.text },
  addBtn:    { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  addBtnText:{ color: colors.bg, fontWeight: '800', fontSize: 13 },
  list:      { padding: 16, gap: 12, paddingBottom: 32 },
  empty:     { textAlign: 'center', color: colors.textFaint, marginTop: 40, fontSize: 14, lineHeight: 22 },
  card:      { backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  avatar:    { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  avatarText:{ fontSize: 16, fontWeight: '700', color: colors.primary },
  dname:     { fontSize: 14, fontWeight: '700', color: colors.text },
  dcontact:  { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  pill:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  pillText:  { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  statsRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  statVal:   { fontSize: 13, fontWeight: '700', color: colors.text, textAlign: 'center' },
  statLabel: { fontSize: 10, color: colors.textFaint, marginTop: 2 },
  modal:     { flex: 1, backgroundColor: colors.bg },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  close:     { color: colors.textMuted, fontSize: 20 },
  modalTitle:{ fontSize: 17, fontWeight: '700', color: colors.text },
  modalBody: { padding: 20 },
  label:     { fontSize: 12, color: colors.textMuted, marginBottom: 6, marginTop: 14 },
  input:     { backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, padding: 14, fontSize: 14 },
  note:      { fontSize: 12, color: colors.textFaint, marginTop: 16, lineHeight: 18 },
  saveBtn:   { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 20 },
  saveBtnText:{ color: colors.bg, fontWeight: '800', fontSize: 15 },
});
