import React, { useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';

const HELP_OPTIONS = [
  { type: 'cannot_find_pickup', label: 'Cannot find pickup location' },
  { type: 'customer_not_present', label: 'Customer is not present' },
  { type: 'vehicle_breakdown', label: 'Vehicle has broken down' },
  { type: 'cargo_issue', label: 'Report a cargo issue' },
  { type: 'other', label: 'Other issue' },
];

export default function SosScreen() {
  const [bookingRef, setBookingRef] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);

  const handleHelp = async (type) => {
    if (!bookingRef.trim()) {
      Alert.alert('Required', 'Enter your booking reference.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/help', { booking_id: bookingRef.trim(), help_type: type, message });
      Alert.alert('Help sent', 'Admin has been notified.');
      setMessage('');
    } catch (requestError) {
      Alert.alert('Error', requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSOS = () => {
    if (!bookingRef.trim()) {
      Alert.alert('Required', 'Enter your booking reference.');
      return;
    }

    Alert.alert('Trigger SOS?', 'Admin will be alerted immediately and the booking will be frozen.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Trigger SOS',
        style: 'destructive',
        onPress: async () => {
          setSosLoading(true);
          try {
            await api.post('/help/sos', { booking_id: bookingRef.trim(), message });
            Alert.alert('SOS triggered', 'Admin alerted. Booking frozen until support intervenes.');
          } catch (requestError) {
            Alert.alert('Error', requestError.message);
          } finally {
            setSosLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>Help and SOS</Text>
        <Text style={s.sub}>Get urgent support for your active trip.</Text>

        <Text style={s.label}>Booking Reference</Text>
        <TextInput
          style={s.input}
          value={bookingRef}
          onChangeText={setBookingRef}
          placeholder="ZTO-2026-1234"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="characters"
        />

        <Text style={s.label}>Additional Message</Text>
        <TextInput
          style={[s.input, { height: 70 }]}
          value={message}
          onChangeText={setMessage}
          placeholder="Describe your situation"
          placeholderTextColor={colors.textFaint}
          multiline
        />

        <Text style={s.sectionTitle}>Help Options</Text>
        {HELP_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.type}
            style={s.helpBtn}
            onPress={() => handleHelp(option.type)}
            disabled={loading}>
            <Text style={s.helpLabel}>{option.label}</Text>
            {loading ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : (
              <Text style={s.arrow}>Open</Text>
            )}
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={s.sosBtn} onPress={handleSOS} disabled={sosLoading}>
          {sosLoading ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <>
              <Text style={s.sosTitle}>EMERGENCY SOS</Text>
              <Text style={s.sosSub}>Instantly alerts admin and freezes the booking.</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 6 },
  sub: { fontSize: 13, color: colors.textMuted, marginBottom: 24 },
  label: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  input: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    padding: 14,
    fontSize: 14,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12, marginTop: 8 },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  helpLabel: { flex: 1, fontSize: 14, color: colors.text },
  arrow: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  sosBtn: { backgroundColor: colors.danger, borderRadius: 16, padding: 28, alignItems: 'center', marginTop: 20 },
  sosTitle: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  sosSub: { fontSize: 12, color: 'rgba(255,255,255,0.78)', marginTop: 6, textAlign: 'center' },
});
