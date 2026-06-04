// app/(driver)/profile.js — PRD 5.4
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';

const DOCS = [
  { key: 'license_verified',          label: 'Driving License'     },
  { key: 'kra_pin_verified',           label: 'KRA PIN'             },
  { key: 'police_clearance_verified',  label: 'Police Clearance'    },
  { key: 'medical_verified',           label: 'Medical Certificate' },
  { key: 'ntsa_verified',              label: 'NTSA Validation'     },
  { key: 'contract_signed',            label: 'Driver Contract'     },
  { key: 'oath_signed',                label: 'Driver Oath'         },
  { key: 'sop_signed',                 label: 'SOP Agreement'       },
];

export default function ProfileScreen() {
  const { user, logout }    = useAuth();
  const [driver, setDriver] = useState(null);
  const [available, setAvail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await api.get('/driver/profile');
      const d = data.data?.driver || data.data;
      if (d) { setDriver(d); setAvail(!!d.is_available); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleAvail = async (val) => {
    setToggling(true);
    try { await api.patch('/driver/availability', { is_available: val }); setAvail(val); }
    catch (e) { Alert.alert('Error', e.message); }
    finally { setToggling(false); }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const initials = (user?.full_name || 'D').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const compliance = driver?.compliance_status || 'pending';
  const compColor  = compliance === 'approved' ? colors.success : compliance === 'rejected' ? colors.danger : colors.warning;

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>;

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>

        <View style={s.profileCard}>
          <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
          <Text style={s.name}>{user?.full_name}</Text>
          <Text style={s.email}>{user?.email}</Text>
          <View style={[s.badge, { backgroundColor: compColor + '20', borderColor: compColor }]}>
            <Text style={[s.badgeText, { color: compColor }]}>{compliance.replace('_', ' ').toUpperCase()}</Text>
          </View>
        </View>

        <View style={s.card}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Availability</Text>
              <Text style={s.cardSub}>{available ? 'Visible to assignment engine' : 'Will not receive new assignments'}</Text>
            </View>
            {toggling ? <ActivityIndicator color={colors.primary} /> :
              <Switch value={available} onValueChange={toggleAvail} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />}
          </View>
        </View>

        {driver && (
          <View style={s.statsRow}>
            <View style={s.stat}><Text style={s.statVal}>{driver.total_trips || 0}</Text><Text style={s.statLabel}>Trips</Text></View>
            <View style={s.stat}><Text style={s.statVal}>⭐ {Number(driver.avg_rating || 0).toFixed(1)}</Text><Text style={s.statLabel}>Rating</Text></View>
            <View style={s.stat}><Text style={s.statVal}>{driver.license_class || '—'}</Text><Text style={s.statLabel}>License</Text></View>
          </View>
        )}

        <Text style={s.sectionTitle}>Compliance Documents</Text>
        <View style={s.card}>
          {DOCS.map(doc => (
            <View key={doc.key} style={s.docRow}>
              <Text style={s.docLabel}>{doc.label}</Text>
              <Text style={driver?.[doc.key] ? s.verified : s.pending}>{driver?.[doc.key] ? '✅ Verified' : '⏳ Pending'}</Text>
            </View>
          ))}
        </View>

        <Text style={s.note}>Documents are reviewed by the Zito operations team at Aurenza Limited. Contact support for updates.</Text>

        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bg },
  center:      { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  content:     { padding: 20, paddingBottom: 40 },
  profileCard: { backgroundColor: colors.bgCard, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  avatar:      { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary + '25', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText:  { fontSize: 24, fontWeight: '800', color: colors.primary },
  name:        { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4 },
  email:       { fontSize: 13, color: colors.textMuted, marginBottom: 12 },
  badge:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  badgeText:   { fontSize: 12, fontWeight: '700' },
  card:        { backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle:   { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  cardSub:     { fontSize: 12, color: colors.textMuted },
  statsRow:    { flexDirection: 'row', gap: 10, marginBottom: 16 },
  stat:        { flex: 1, backgroundColor: colors.bgCard, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statVal:     { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 },
  statLabel:   { fontSize: 11, color: colors.textFaint },
  sectionTitle:{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 },
  docRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  docLabel:    { fontSize: 13, color: colors.text },
  verified:    { fontSize: 12, color: colors.success, fontWeight: '600' },
  pending:     { fontSize: 12, color: colors.warning, fontWeight: '600' },
  note:        { fontSize: 12, color: colors.textFaint, marginBottom: 24, lineHeight: 18 },
  logoutBtn:   { backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.danger },
  logoutText:  { color: colors.danger, fontWeight: '700', fontSize: 15 },
});
