// app/(customer)/book.js — PRD 5.3, 7.12, 7.13
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import SearchablePicker from '../../src/components/SearchablePicker';
import VehicleTypePicker from '../../src/components/VehicleTypePicker';
import { api } from '../../src/api/client';
import { colors, VEHICLE_TYPES, estimatePrice } from '../../src/constants/theme';

// Replace with your actual API key from Google Cloud Console
const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY_HERE';

// PRD §5: Custom dark map style for ZITO aesthetic
const DARK_MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#263c3f" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#6b9a76" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#746855" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#1f2835" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#f3d19c" }] },
  { "featureType": "transit", "elementType": "geometry", "stylers": [{ "color": "#2f3948" }] },
  { "featureType": "transit.station", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#515c6d" }] },
  { "featureType": "water", "elementType": "labels.text.stroke", "stylers": [{ "color": "#17263c" }] }
];

export default function BookScreen() {
  const [step, setStep]           = useState(1);
  const [vehicleType, setVehicle] = useState(null);
  const [pickup, setPickup]       = useState({ address: '', lat: null, lng: null });
  const [delivery, setDelivery]   = useState({ address: '', lat: null, lng: null });
  const [cargoType, setCargo]     = useState('');
  const [weightKg, setWeight]     = useState('');
  const [desc, setDesc]           = useState('');
  const [instructions, setInstr]  = useState('');
  const [scheduled, setScheduled] = useState(false);
  const [loading, setLoading]     = useState(false);

  // PRD §5: Helper for reverse geocoding to satisfy mandatory address requirements
  const updateAddress = async (lat, lng, setter) => {
    try {
      const [res] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const addr = res ? `${res.name || res.street || ''}, ${res.city || ''}`.trim().replace(/^,/, '').trim() : 'Pinned Location';
      setter({ address: addr || 'Unknown Location', lat, lng });
    } catch (_e) {
      setter({ address: 'Pinned Location', lat, lng });
    }
  };

  // PRD §5: Automatically fetch current location as default pickup
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      let location = await Location.getCurrentPositionAsync({});
      updateAddress(location.coords.latitude, location.coords.longitude, setPickup);
    })();
  }, []);

  const vehicle  = VEHICLE_TYPES.find(v => v.key === vehicleType);
  const estimate = estimatePrice(vehicleType, parseFloat(weightKg || 0));
  const fmt = v  => Number(v).toLocaleString();

  const handleBook = async () => {
    setLoading(true);
    try {
      const data = await api.post('/api/v1/customer/bookings', {
        serviceType: 'COURIER', // PRD §1: Maps to ServiceType enum in schema.prisma
        totalPrice: estimate,   // Matches totalPrice field in schema.prisma
        idempotencyKey: `bk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, // PRD §28
        stops: [                // PRD §6: Multi-stop routing via BookingStop model
          {
            sequence: 1,
            address: pickup.address,
            latitude: pickup.lat,
            longitude: pickup.lng,
            stopType: 'PICKUP',
            contactName: 'Current User', // Required in BookingStop model
            contactPhone: 'N/A'
          },
          {
            sequence: 2,
            address: delivery.address,
            latitude: delivery.lat,
            longitude: delivery.lng,
            stopType: 'DELIVERY',
            contactName: 'Receiver',
            contactPhone: 'N/A'
          }
        ],
        // Using camelCase for additional metadata to match schema convention
        cargoType: cargoType,
        cargoWeightKg: parseFloat(weightKg) || null,
        cargoDescription: desc, 
        specialInstructions: instructions,
        isScheduled: scheduled,
      });
      Alert.alert('Booking Created! 🎉', `Reference: ${data.data?.reference}\n\nAdmin will review and assign a driver.`, [
        {
          text: 'OK',
          onPress: () => {
            setStep(1);
            setVehicle(null);
            setPickup({ address: '', lat: null, lng: null });
            setDelivery({ address: '', lat: null, lng: null });
            setCargo('');
            setWeight('');
          }
        }
      ]);
    } catch (e) { Alert.alert('Error', e.message); }
    finally {setLoading(false); }
  };

  // PRD §6: Simple validation to ensure cargo doesn't exceed vehicle capacity
  const getWeightLimit = (capStr) => {
    if (!capStr) return Infinity;
    const match = capStr.match(/(\d+)/);
    return match ? parseInt(match[1]) * (capStr.toLowerCase().includes('ton') ? 1000 : 1) : Infinity;
  };
  const isOverweight = vehicle && weightKg && parseFloat(weightKg) > getWeightLimit(vehicle.capacity);

  // Validation for PRD §5: Ensure coordinates are present
  const canContinueToReview =
    pickup.lat &&
    delivery.lat &&
    !isOverweight;

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
            <VehicleTypePicker 
              vehicles={VEHICLE_TYPES} 
              selectedType={vehicleType} 
              onSelect={setVehicle} 
            />
            <TouchableOpacity style={[s.btn, !vehicleType && s.btnDisabled]} onPress={() => vehicleType && setStep(2)} disabled={!vehicleType}>
              <Text style={s.btnText}>Continue →</Text>
            </TouchableOpacity>
          </>
        )}

        {/* STEP 2: Details */}
        {step === 2 && (
          <>
            <Text style={s.stepTitle}>Cargo & Route</Text>
            <Text style={s.stepSub}>PRD §5: Map-based location selection required</Text>
            <TouchableOpacity onPress={() => setStep(1)} style={s.back}><Text style={s.backText}>← Back</Text></TouchableOpacity>

            {/* PRD §5: Visual Map Confirmation & Adjustment */}
            <View style={s.mapContainer}>
              <MapView
                style={s.map}
                customMapStyle={DARK_MAP_STYLE}
                region={{
                  latitude: pickup.lat || -1.286389,
                  longitude: pickup.lng || 36.817223,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                initialRegion={{
                  latitude: pickup.lat || -1.286389,
                  longitude: pickup.lng || 36.817223,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                onLongPress={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  updateAddress(latitude, longitude, setDelivery);
                }}
              >
                {pickup.lat && (
                  <Marker draggable
                    coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
                    pinColor={colors.primary}
                    title="Pickup"
                    onDragEnd={(e) => updateAddress(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude, setPickup)} />
                )}
                {delivery.lat && (
                  <Marker draggable
                    coordinate={{ latitude: delivery.lat, longitude: delivery.lng }}
                    pinColor="#ff4444"
                    title="Delivery"
                    onDragEnd={(e) => updateAddress(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude, setDelivery)} />
                )}
              </MapView>
              <Text style={s.mapHint}>Long press map to set delivery • Drag markers to adjust</Text>
            </View>
            <Text style={s.label}>Pickup Location (Lat/Lng Required) *</Text>
            <SearchablePicker
              placeholder="Search pickup address"
              onLocationSelect={setPickup}
              apiKey={GOOGLE_MAPS_API_KEY}
            />

            <Text style={s.label}>Delivery Location (Lat/Lng Required) *</Text>
            <SearchablePicker
              placeholder="Search delivery address"
              onLocationSelect={setDelivery}
              apiKey={GOOGLE_MAPS_API_KEY}
            />

            {[
              { label: 'Cargo Type', val: cargoType, set: setCargo, ph: 'Electronics, Furniture…', multi: false },
              { label: 'Weight (kg)', val: weightKg, set: setWeight, ph: 'Approx weight', num: true },
              { label: 'Description', val: desc, set: setDesc, ph: 'Describe your cargo', multi: true },
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

            <TouchableOpacity 
              style={[s.btn, (!canContinueToReview) && s.btnDisabled]} 
              onPress={() => {
                if (isOverweight) return Alert.alert('Weight Limit Exceeded', `The selected vehicle carries max ${vehicle.capacity}.`);
                (pickup.lat && delivery.lat) && setStep(3);
              }} 
              disabled={!canContinueToReview}>
              <Text style={s.btnText}>Review Booking →</Text>
            </TouchableOpacity>
          </>
        )}

        {/* STEP 3: Review */}
        {step === 3 && (
          <>
            <Text style={s.stepTitle}>Review & Confirm</Text>
            <TouchableOpacity onPress={() => setStep(2)} style={s.back}><Text style={s.backText}>← Back</Text></TouchableOpacity>

            <View style={s.summaryCard}>
              {[
                ['Vehicle',   vehicle?.label || vehicleType],
                ['Pickup',    pickup.address],
                ['Delivery',  delivery.address],
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
  mapContainer: { height: 200, borderRadius: 14, overflow: 'hidden', marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  map:          { flex: 1 },
  mapHint:      { fontSize: 10, color: colors.textFaint, textAlign: 'center', marginTop: 4 },
  locationPicker: { backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, minHeight: 50, justifyContent: 'center' },
  locationPlaceholder: { color: colors.textFaint, fontSize: 14 },
  locationText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
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
