// app/(customer)/profile.js
import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { colors } from '../../src/constants/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const initials = (user?.full_name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>Profile</Text>
        <View style={s.card}>
          <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
          <Text style={s.name}>{user?.full_name}</Text>
          <Text style={s.email}>{user?.email}</Text>
          {user?.phone && <Text style={s.phone}>{user?.phone}</Text>}
        </View>
        <View style={s.infoCard}>
          {[['Role', user?.role], ['Email', user?.email], ['Phone', user?.phone || '—']].map(([l, v]) => (
            <View key={l} style={s.row}>
              <Text style={s.rowLabel}>{l}</Text>
              <Text style={s.rowVal}>{v || '—'}</Text>
            </View>
          ))}
        </View>
        <View style={s.infoCard}>
          <Text style={s.sectionTitle}>About ZITO</Text>
          <Text style={s.about}>ZITO is Kenya's next-generation logistics platform — connecting customers, drivers and transporters in one smart ecosystem.</Text>
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
  content:     { padding: 20, paddingBottom: 40 },
  title:       { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 20 },
  card:        { backgroundColor: colors.bgCard, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  avatar:      { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary + '25', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText:  { fontSize: 24, fontWeight: '800', color: colors.primary },
  name:        { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4 },
  email:       { fontSize: 13, color: colors.textMuted },
  phone:       { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  infoCard:    { backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  row:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel:    { fontSize: 13, color: colors.textMuted },
  rowVal:      { fontSize: 13, color: colors.text, fontWeight: '600' },
  sectionTitle:{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10 },
  about:       { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  logoutBtn:   { backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.danger },
  logoutText:  { color: colors.danger, fontWeight: '700', fontSize: 15 },
});
