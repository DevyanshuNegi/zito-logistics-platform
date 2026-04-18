import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '../../src/api/client';
import { colors, VEHICLE_TYPES, estimatePrice } from '../../src/constants/theme';

const CARGO_TYPES = ['general', 'fragile', 'perishable', 'machinery', 'electronics', 'furniture', 'other'];

export default function BookScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [vehicleType, setVehicle] = useState(null);
  const [pickup, setPickup] = useState('');
  const [delivery, setDelivery] = useState('');
  const [stopInput, setStopInput] = useState('');
  const [stops, setStops] = useState([]);
  const [cargoType, setCargo] = useState('general');
  const [weightKg, setWeight] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [desc, setDesc] = useState('');
  const [instructions, setInstr] = useState('');
  const [scheduled, setScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState('weekly');
  const [paymentMethod, setPaymentMethod] = useState('mpesa');
  const [loading, setLoading] = useState(false);

  const vehicle = VEHICLE_TYPES.find((entry) => entry.key === vehicleType);
  const estimate = useMemo(() => {
    const base = estimatePrice(vehicleType, parseFloat(weightKg || 0), parseFloat(distanceKm || 0) || 20);
    return base + (stops.length * 250);
  }, [distanceKm, stops.length, vehicleType, weightKg]);

  const fmt = (value) => Number(value || 0).toLocaleString();

  const resetForm = () => {
    setStep(1);
    setVehicle(null);
    setPickup('');
    setDelivery('');
    setStopInput('');
    setStops([]);
    setCargo('general');
    setWeight('');
    setDistanceKm('');
    setDesc('');
    setInstr('');
    setScheduled(false);
    setScheduledAt('');
    setIsRecurring(false);
    setRecurrencePattern('weekly');
    setPaymentMethod('mpesa');
  };

  const addStop = () => {
    const value = stopInput.trim();
    if (!value) return;
    setStops((current) => [...current, value]);
    setStopInput('');
  };

  const removeStop = (index) => {
    setStops((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleBook = async () => {
    setLoading(true);
    try {
      const response = await api.post('/api/v1/customer/bookings', {
        pickup_address: pickup,
        delivery_address: delivery,
        additional_stops: stops,
        vehicle_type: vehicleType,
        cargo_type: cargoType,
        cargo_weight_kg: parseFloat(weightKg) || 0,
        cargo_description: desc,
        special_instructions: instructions,
        distance_km: parseFloat(distanceKm) || 0,
        payment_method: paymentMethod,
        scheduled_at: scheduled ? scheduledAt || undefined : undefined,
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? recurrencePattern : undefined,
        customer_rate: estimate,
      });

      Alert.alert(
        'Booking Created',
        `Reference: ${response.data?.booking?.reference || 'Pending'}\n\nMaps and live routing will plug in later. The booking is now in the operational workflow.`,
        [{ text: 'OK', onPress: resetForm }],
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.stepBar}>
        {[1, 2, 3].map((item) => (
          <View key={item} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.dot, step >= item && styles.dotActive]}>
              <Text style={[styles.dotNum, step >= item && styles.dotNumActive]}>{step > item ? 'OK' : item}</Text>
            </View>
            {item < 3 && <View style={[styles.line, step > item && styles.lineActive]} />}
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <>
            <Text style={styles.stepTitle}>Select Vehicle Type</Text>
            <Text style={styles.stepSub}>Choose a backend-valid vehicle class before you build the route.</Text>

            {VEHICLE_TYPES.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.vehicleCard, vehicleType === item.key && styles.vehicleCardActive]}
                onPress={() => setVehicle(item.key)}
              >
                <Text style={styles.vehicleIcon}>{item.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vehicleName}>{item.label}</Text>
                  <Text style={styles.vehicleCap}>Max {item.capacity}</Text>
                  <Text style={styles.vehiclePrice}>From KES {fmt(item.base)} · KES {item.perKm}/km</Text>
                </View>
                {vehicleType === item.key && <Text style={styles.check}>OK</Text>}
              </TouchableOpacity>
            ))}

            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                Live map lookup and address autocomplete will be enabled later. For now, enter exact route details manually.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.btn, !vehicleType && styles.btnDisabled]}
              onPress={() => vehicleType && setStep(2)}
              disabled={!vehicleType}
            >
              <Text style={styles.btnText}>Continue</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.stepTitle}>Cargo & Route</Text>
            <TouchableOpacity onPress={() => setStep(1)} style={styles.back}>
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            {[
              { label: 'Pickup Address *', value: pickup, setter: setPickup, placeholder: 'Enter pickup location', multi: true },
              { label: 'Delivery Address *', value: delivery, setter: setDelivery, placeholder: 'Enter delivery location', multi: true },
              { label: 'Cargo Description', value: desc, setter: setDesc, placeholder: 'Describe the cargo', multi: true },
              { label: 'Special Instructions', value: instructions, setter: setInstr, placeholder: 'Fragile, loading notes, gate contact...', multi: true },
            ].map((field) => (
              <View key={field.label}>
                <Text style={styles.label}>{field.label}</Text>
                <TextInput
                  style={[styles.input, field.multi && styles.multilineInput]}
                  value={field.value}
                  onChangeText={field.setter}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.textFaint}
                  multiline={field.multi}
                />
              </View>
            ))}

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Cargo Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    {CARGO_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[styles.chip, cargoType === type && styles.chipActive]}
                        onPress={() => setCargo(type)}
                      >
                        <Text style={[styles.chipText, cargoType === type && styles.chipTextActive]}>
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Weight (kg)</Text>
                <TextInput
                  style={styles.input}
                  value={weightKg}
                  onChangeText={setWeight}
                  keyboardType="numeric"
                  placeholder="Approx weight"
                  placeholderTextColor={colors.textFaint}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Distance Estimate (km)</Text>
                <TextInput
                  style={styles.input}
                  value={distanceKm}
                  onChangeText={setDistanceKm}
                  keyboardType="numeric"
                  placeholder="Manual distance"
                  placeholderTextColor={colors.textFaint}
                />
              </View>
            </View>

            <View style={styles.stopComposer}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={stopInput}
                onChangeText={setStopInput}
                placeholder="Add intermediate stop"
                placeholderTextColor={colors.textFaint}
              />
              <TouchableOpacity style={styles.addStopBtn} onPress={addStop}>
                <Text style={styles.addStopText}>Add</Text>
              </TouchableOpacity>
            </View>

            {stops.length > 0 && (
              <View style={styles.stopList}>
                {stops.map((stop, index) => (
                  <TouchableOpacity key={`${stop}-${index}`} style={styles.stopChip} onPress={() => removeStop(index)}>
                    <Text style={styles.stopChipText}>{stop}</Text>
                    <Text style={styles.stopChipRemove}>Remove</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Schedule for later</Text>
              <Switch value={scheduled} onValueChange={setScheduled} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
            </View>
            {scheduled && (
              <TextInput
                style={styles.input}
                value={scheduledAt}
                onChangeText={setScheduledAt}
                placeholder="YYYY-MM-DDTHH:MM"
                placeholderTextColor={colors.textFaint}
              />
            )}

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Recurring booking</Text>
              <Switch value={isRecurring} onValueChange={setIsRecurring} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
            </View>
            {isRecurring && (
              <View style={styles.chipRow}>
                {['daily', 'weekly', 'monthly'].map((pattern) => (
                  <TouchableOpacity
                    key={pattern}
                    style={[styles.chip, recurrencePattern === pattern && styles.chipActive]}
                    onPress={() => setRecurrencePattern(pattern)}
                  >
                    <Text style={[styles.chipText, recurrencePattern === pattern && styles.chipTextActive]}>
                      {pattern}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>Payment Method</Text>
            <View style={styles.chipRow}>
              {['mpesa', 'bank', 'cash'].map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[styles.chip, paymentMethod === method && styles.chipActive]}
                  onPress={() => setPaymentMethod(method)}
                >
                  <Text style={[styles.chipText, paymentMethod === method && styles.chipTextActive]}>
                    {method}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.btn, (!pickup || !delivery || !distanceKm || !weightKg) && styles.btnDisabled]}
              onPress={() => pickup && delivery && distanceKm && weightKg && setStep(3)}
              disabled={!pickup || !delivery || !distanceKm || !weightKg}
            >
              <Text style={styles.btnText}>Review Booking</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.stepTitle}>Confirm Booking</Text>
            <TouchableOpacity onPress={() => setStep(2)} style={styles.back}>
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            <View style={styles.summaryCard}>
              {[
                ['Vehicle', vehicle?.label || vehicleType],
                ['Pickup', pickup],
                ['Delivery', delivery],
                ['Stops', stops.length ? stops.join(', ') : 'Direct trip'],
                ['Cargo', cargoType],
                ['Weight', `${weightKg} kg`],
                ['Distance', `${distanceKm} km`],
                ['Payment', paymentMethod],
                scheduled && ['Scheduled', scheduledAt || 'Later'],
                isRecurring && ['Recurring', recurrencePattern],
              ].filter(Boolean).map(([label, value]) => (
                <View key={label} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{label}</Text>
                  <Text style={styles.summaryVal}>{value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.priceCard}>
              <Text style={styles.priceLabel}>Estimated Price</Text>
              <Text style={styles.priceAmt}>KES {fmt(estimate)}</Text>
              <Text style={styles.priceNote}>
                This is the frontend estimate for the PRD flow. Finance and live routing services can refine it later without changing the booking contract.
              </Text>
            </View>

            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleBook} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.btnText}>Confirm Booking</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.ghostBtn} onPress={() => router.push('/(customer)/track')}>
              <Text style={styles.ghostBtnText}>Go to Tracking</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  stepBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, paddingBottom: 8 },
  dot: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  dotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotNum: { fontSize: 12, fontWeight: '700', color: colors.textFaint },
  dotNumActive: { color: colors.bg },
  line: { width: 50, height: 2, backgroundColor: colors.border },
  lineActive: { backgroundColor: colors.primary },
  content: { padding: 20, paddingBottom: 40 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 6 },
  stepSub: { fontSize: 13, color: colors.textMuted, marginBottom: 20 },
  vehicleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: colors.border, gap: 14 },
  vehicleCardActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
  vehicleIcon: { fontSize: 20, fontWeight: '800', color: colors.primary, width: 34, textAlign: 'center' },
  vehicleName: { fontSize: 15, fontWeight: '700', color: colors.text },
  vehicleCap: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  vehiclePrice: { fontSize: 12, color: colors.primary, marginTop: 2 },
  check: { fontSize: 14, color: colors.primary, fontWeight: '800' },
  notice: { backgroundColor: `${colors.info}15`, borderColor: `${colors.info}40`, borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 4 },
  noticeText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  label: { fontSize: 12, color: colors.textMuted, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, padding: 14, fontSize: 14 },
  multilineInput: { height: 72, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  stopComposer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  addStopBtn: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14 },
  addStopText: { color: colors.text, fontWeight: '700' },
  stopList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  stopChip: { backgroundColor: `${colors.purple}20`, borderColor: `${colors.purple}40`, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  stopChipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  stopChipRemove: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  switchLabel: { fontSize: 14, color: colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: `${colors.primary}20`, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontWeight: '600', fontSize: 12 },
  chipTextActive: { color: colors.primary },
  btn: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: colors.bg, fontSize: 16, fontWeight: '800' },
  ghostBtn: { borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12 },
  ghostBtnText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  back: { marginBottom: 16 },
  backText: { color: colors.textMuted, fontSize: 14 },
  summaryCard: { backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  summaryLabel: { fontSize: 13, color: colors.textMuted, flex: 1 },
  summaryVal: { fontSize: 13, color: colors.text, flex: 2, textAlign: 'right' },
  priceCard: { backgroundColor: `${colors.primary}15`, borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: `${colors.primary}40` },
  priceLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 6 },
  priceAmt: { fontSize: 32, fontWeight: '900', color: colors.primary },
  priceNote: { fontSize: 12, color: colors.textFaint, marginTop: 8, textAlign: 'center', lineHeight: 18 },
});
