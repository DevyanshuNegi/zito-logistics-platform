// app/(transporter)/profile.js — PRD 5.5
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';

export default function ProfileScreen() {
  const { user, logout }    = useAuth();
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await api.get('/api/v1/transporter/dashboard').catch(() => ({ data: {} }));
      setStats(data.data || {});
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const initials = (user?.full_name || 'T').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>;

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>

        <Text style={s.title}>Profile</Text>

        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
          <Text style={s.name}>{user?.full_name}</Text>
          <Text style={s.email}>{user?.email}</Text>
          {user?.phone && <Text style={s.phone}>{user?.phone}</Text>}
          {user?.company_name && (
            <View style={s.companyBadge}>
              <Text style={s.companyText}>🏭 {user.company_name}</Text>
            </View>
          )}
        </View>

        {/* Fleet stats */}
        {stats && (
          <View style={s.statsRow}>
            {[
              { val: stats.totalVehicles   ?? 0, label: 'Vehicles'  },
              { val: stats.activeDrivers   ?? 0, label: 'Drivers'   },
              { val: stats.totalBookings   ?? 0, label: 'Bookings'  },
              { val: stats.completedBookings ?? 0, label: 'Completed' },
            ].map(({ val, label }) => (
              <View key={label} style={s.stat}>
                <Text style={s.statVal}>{val}</Text>
                <Text style={s.statLabel}>{label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Account info */}
        <View style={s.infoCard}>
          {[
            { label: 'Role',    val: 'Transporter'     },
            { label: 'Email',   val: user?.email        },
            { label: 'Phone',   val: user?.phone || '—' },
          ].map(({ label, val }) => (
            <View key={label} style={s.row}>
              <Text style={s.rowLabel}>{label}</Text>
              <Text style={s.rowVal}>{val}</Text>
            </View>
          ))}
        </View>

        {/* Note on compliance */}
        <View style={s.noteCard}>
          <Text style={s.noteTitle}>📋 Platform Rules</Text>
          <Text style={s.noteText}>All driver assignments, vehicle verifications, and booking approvals are managed by ZITO Admin. Ensure all documents are up to date to avoid trip disruptions.</Text>
        </View>

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
  title:       { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 20 },
  profileCard: { backgroundColor: colors.bgCard, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  avatar:      { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary + '25', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText:  { fontSize: 24, fontWeight: '800', color: colors.primary },
  name:        { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4 },
  email:       { fontSize: 13, color: colors.textMuted },
  phone:       { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  companyBadge:{ marginTop: 10, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: colors.primary + '15', borderRadius: 20, borderWidth: 1, borderColor: colors.primary + '40' },
  companyText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  statsRow:    { flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  stat:        { flex: 1, minWidth: '22%', backgroundColor: colors.bgCard, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statVal:     { fontSize: 20, fontWeight: '800', color: colors.text },
  statLabel:   { fontSize: 10, color: colors.textFaint, marginTop: 4, textAlign: 'center' },
  infoCard:    { backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  row:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel:    { fontSize: 13, color: colors.textMuted },
  rowVal:      { fontSize: 13, color: colors.text, fontWeight: '600' },
  noteCard:    { backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.border },
  noteTitle:   { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 },
  noteText:    { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  logoutBtn:   { backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.danger },
  logoutText:  { color: colors.danger, fontWeight: '700', fontSize: 15 },
});
