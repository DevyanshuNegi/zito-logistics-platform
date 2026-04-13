// app/(driver)/sos.js — PRD Section 19.2
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';

const HELP_OPTIONS = [
  { type: 'cannot_find_pickup',   label: 'Cannot find pickup location', icon: '📍' },
  { type: 'customer_not_present', label: 'Customer is not present',     icon: '👤' },
  { type: 'vehicle_breakdown',    label: 'Vehicle has broken down',     icon: '🔧' },
  { type: 'cargo_issue',          label: 'Report a cargo issue',        icon: '📦' },
  { type: 'other',                label: 'Other issue',                 icon: '💬' },
];

export default function SosScreen() {
  const [bookingRef, setBookingRef] = useState('');
  const [message, setMessage]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [sosLoading, setSosLoading] = useState(false);

  const handleHelp = async (type) => {
    if (!bookingRef.trim()) { Alert.alert('Required', 'Enter your Booking Reference.'); return; }
    setLoading(true);
    try {
      await api.post('/api/v1/help', { booking_id: bookingRef.trim(), help_type: type, message });
      Alert.alert('Help Sent ✓', 'Admin has been notified.');
      setMessage('');
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  const handleSOS = () => {
    if (!bookingRef.trim()) { Alert.alert('Required', 'Enter your Booking Reference.'); return; }
    Alert.alert('🆘 Trigger SOS?', 'Admin will be alerted immediately. Booking will be frozen.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'TRIGGER SOS', style: 'destructive', onPress: async () => {
        setSosLoading(true);
        try {
          await api.post('/api/v1/help/sos', { booking_id: bookingRef.trim(), message });
          Alert.alert('SOS Triggered', 'Admin alerted. Booking frozen until admin intervenes.');
        } catch (e) { Alert.alert('Error', e.message); }
        finally { setSosLoading(false); }
      }},
    ]);
  };

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>Help & SOS</Text>
        <Text style={s.sub}>Get help for your active trip</Text>

        <Text style={s.label}>Booking Reference</Text>
        <TextInput style={s.input} value={bookingRef} onChangeText={setBookingRef}
          placeholder="VGL-2026-1234" placeholderTextColor={colors.textFaint} autoCapitalize="characters" />

        <Text style={s.label}>Additional Message (optional)</Text>
        <TextInput style={[s.input, { height: 70 }]} value={message} onChangeText={setMessage}
          placeholder="Describe your situation..." placeholderTextColor={colors.textFaint} multiline />

        <Text style={s.sectionTitle}>Help Options</Text>
        {HELP_OPTIONS.map(opt => (
          <TouchableOpacity key={opt.type} style={s.helpBtn} onPress={() => handleHelp(opt.type)} disabled={loading}>
            <Text style={s.helpIcon}>{opt.icon}</Text>
            <Text style={s.helpLabel}>{opt.label}</Text>
            {loading ? <ActivityIndicator size="small" color={colors.textMuted} /> : <Text style={s.arrow}>→</Text>}
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={s.sosBtn} onPress={handleSOS} disabled={sosLoading}>
          {sosLoading ? <ActivityIndicator color="#fff" size="large" /> : (
            <>
              <Text style={s.sosIcon}>🆘</Text>
              <Text style={s.sosTitle}>EMERGENCY SOS</Text>
              <Text style={s.sosSub}>Instantly alerts Admin · Freezes booking</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bg },
  content:     { padding: 20, paddingBottom: 40 },
  title:       { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 6 },
  sub:         { fontSize: 13, color: colors.textMuted, marginBottom: 24 },
  label:       { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  input:       { backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, padding: 14, fontSize: 14, marginBottom: 14 },
  sectionTitle:{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12, marginTop: 8 },
  helpBtn:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border, gap: 12 },
  helpIcon:    { fontSize: 20 },
  helpLabel:   { flex: 1, fontSize: 14, color: colors.text },
  arrow:       { color: colors.textFaint, fontSize: 16 },
  sosBtn:      { backgroundColor: colors.danger, borderRadius: 16, padding: 28, alignItems: 'center', marginTop: 20 },
  sosIcon:     { fontSize: 40, marginBottom: 8 },
  sosTitle:    { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  sosSub:      { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 6 },
});
