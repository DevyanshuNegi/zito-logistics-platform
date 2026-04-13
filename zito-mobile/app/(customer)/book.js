// app/(customer)/book.js — PRD 5.3, 7.12, 7.13
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '../../src/api/client';
import { colors, VEHICLE_TYPES, estimatePrice } from '../../src/constants/theme';

export default function BookScreen() {
  const router = useRouter();
  const [step, setStep]           = useState(1);
  const [vehicleType, setVehicle] = useState(null);
  const [pickup, setPickup]       = useState('');
  const [delivery, setDelivery]   = useState('');
  const [cargoType, setCargo]     = useState('');
  const [weightKg, setWeight]     = useState('');
  const [desc, setDesc]           = useState('');
  const [instructions, setInstr]  = useState('');
  const [scheduled, setScheduled] = useState(false);
  const [loading, setLoading]     = useState(false);

  const vehicle  = VEHICLE_TYPES.find(v => v.key === vehicleType);
  const estimate = estimatePrice(vehicleType, parseFloat(weightKg || 0));
  const fmt = v  => Number(v).toLocaleString();

  const handleBook = async () => {
    setLoading(true);
    try {
      const data = await api.post('/api/v1/customer/bookings', {
        pickup_address: pickup, delivery_address: delivery,
        vehicle_type: vehicleType, cargo_type: cargoType,
        cargo_weight_kg: parseFloat(weightKg) || null,
        cargo_description: desc, special_instructions: instructions,
        is_scheduled: scheduled, customer_rate: estimate,
      });
      Alert.alert('Booking Created! 🎉', `Reference: ${data.data?.reference}\n\nAdmin will review and assign a driver.`, [
        { text: 'OK', onPress: () => { setStep(1); setVehicle(null); setPickup(''); setDelivery(''); setCargo(''); setWeight(''); } }
      ]);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={s.root}>
      {/* Step bar */}
      <View style={s.stepBar}>
        {[1, 2, 3].map(n => (
          <View key={n} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[s.dot, step >= n && s.dotActive]}>
              <Text style={[s.dotNum, step >= n && s.dotNumActive]}>{step > n ? '✓' : n}</Text>
            </View>
            {n < 3 && <View style={[s.line, step > n && s.lineActive]} />}
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        {/* STEP 1: Vehicle */}
        {step === 1 && (
          <>
            <Text style={s.stepTitle}>Select Vehicle Type</Text>
            <Text style={s.stepSub}>Choose based on cargo size and weight</Text>
            {VEHICLE_TYPES.map(v => (
              <TouchableOpacity key={v.key} style={[s.vehicleCard, vehicleType === v.key && s.vehicleCardActive]} onPress={() => setVehicle(v.key)}>
                <Text style={s.vehicleIcon}>{v.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.vehicleName}>{v.label}</Text>
                  <Text style={s.vehicleCap}>Max {v.capacity}</Text>
                  <Text style={s.vehiclePrice}>From KES {fmt(v.base)} · KES {v.perKm}/km</Text>
                </View>
                {vehicleType === v.key && <Text style={s.check}>✓</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.btn, !vehicleType && s.btnDisabled]} onPress={() => vehicleType && setStep(2)} disabled={!vehicleType}>
              <Text style={s.btnText}>Continue →</Text>
            </TouchableOpacity>
          </>
        )}

        {/* STEP 2: Details */}
        {step === 2 && (
          <>
            <Text style={s.stepTitle}>Cargo & Route</Text>
            <TouchableOpacity onPress={() => setStep(1)} style={s.back}><Text style={s.backText}>← Back</Text></TouchableOpacity>

            {[
              { label: 'Pickup Address *', val: pickup,   set: setPickup,   ph: 'Enter pickup location',   multi: true  },
              { label: 'Delivery Address *', val: delivery, set: setDelivery, ph: 'Enter delivery location',  multi: true  },
              { label: 'Cargo Type',       val: cargoType, set: setCargo,    ph: 'Electronics, Furniture…',  multi: false },
              { label: 'Weight (kg)',      val: weightKg,  set: setWeight,   ph: 'Approx weight',            num: true    },
              { label: 'Description',      val: desc,      set: setDesc,     ph: 'Describe your cargo',      multi: true  },
              { label: 'Special Instructions', val: instructions, set: setInstr, ph: 'Fragile, handle with care…', multi: true },
            ].map(f => (
              <View key={f.label}>
                <Text style={s.label}>{f.label}</Text>
                <TextInput style={[s.input, f.multi && { height: 72 }]} value={f.val} onChangeText={f.set}
                  placeholder={f.ph} placeholderTextColor={colors.textFaint}
                  keyboardType={f.num ? 'numeric' : 'default'} multiline={!!f.multi} />
              </View>
            ))}

            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Schedule for later</Text>
              <Switch value={scheduled} onValueChange={setScheduled} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
            </View>

            <TouchableOpacity style={[s.btn, (!pickup || !delivery) && s.btnDisabled]} onPress={() => (pickup && delivery) && setStep(3)} disabled={!pickup || !delivery}>
              <Text style={s.btnText}>Review Booking →</Text>
            </TouchableOpacity>
          </>
        )}

        {/* STEP 3: Confirm */}
        {step === 3 && (
          <>
            <Text style={s.stepTitle}>Confirm Booking</Text>
            <TouchableOpacity onPress={() => setStep(2)} style={s.back}><Text style={s.backText}>← Back</Text></TouchableOpacity>

            <View style={s.summaryCard}>
              {[
                ['Vehicle',   vehicle?.label || vehicleType],
                ['Pickup',    pickup],
                ['Delivery',  delivery],
                cargoType && ['Cargo', cargoType],
                weightKg  && ['Weight', `${weightKg} kg`],
              ].filter(Boolean).map(([l, v]) => (
                <View key={l} style={s.summaryRow}>
                  <Text style={s.summaryLabel}>{l}</Text>
                  <Text style={s.summaryVal} numberOfLines={2}>{v}</Text>
                </View>
              ))}
            </View>

            <View style={s.priceCard}>
              <Text style={s.priceLabel}>Estimated Price</Text>
              <Text style={s.priceAmt}>KES {fmt(estimate)}</Text>
              <Text style={s.priceNote}>Final price confirmed by admin. No hidden fees.</Text>
            </View>

            <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleBook} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.bg} /> : <Text style={s.btnText}>Confirm Booking 🚀</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bg },
  stepBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, paddingBottom: 8 },
  dot:         { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  dotActive:   { backgroundColor: colors.primary, borderColor: colors.primary },
  dotNum:      { fontSize: 12, fontWeight: '700', color: colors.textFaint },
  dotNumActive:{ color: colors.bg },
  line:        { width: 50, height: 2, backgroundColor: colors.border },
  lineActive:  { backgroundColor: colors.primary },
  content:     { padding: 20, paddingBottom: 40 },
  stepTitle:   { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 6 },
  stepSub:     { fontSize: 13, color: colors.textMuted, marginBottom: 20 },
  vehicleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: colors.border, gap: 14 },
  vehicleCardActive:{ borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  vehicleIcon: { fontSize: 32 },
  vehicleName: { fontSize: 15, fontWeight: '700', color: colors.text },
  vehicleCap:  { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  vehiclePrice:{ fontSize: 12, color: colors.primary, marginTop: 2 },
  check:       { fontSize: 20, color: colors.primary, fontWeight: '800' },
  label:       { fontSize: 12, color: colors.textMuted, marginBottom: 6, marginTop: 14 },
  input:       { backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, padding: 14, fontSize: 14 },
  switchRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  switchLabel: { fontSize: 14, color: colors.text },
  btn:         { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  btnDisabled: { opacity: 0.4 },
  btnText:     { color: colors.bg, fontSize: 16, fontWeight: '800' },
  back:        { marginBottom: 16 },
  backText:    { color: colors.textMuted, fontSize: 14 },
  summaryCard: { backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  summaryRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryLabel:{ fontSize: 13, color: colors.textMuted, flex: 1 },
  summaryVal:  { fontSize: 13, color: colors.text, flex: 2, textAlign: 'right', marginLeft: 12 },
  priceCard:   { backgroundColor: colors.primary + '15', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: colors.primary + '40' },
  priceLabel:  { fontSize: 13, color: colors.textMuted, marginBottom: 6 },
  priceAmt:    { fontSize: 32, fontWeight: '900', color: colors.primary },
  priceNote:   { fontSize: 12, color: colors.textFaint, marginTop: 8, textAlign: 'center' },
});
