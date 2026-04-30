import React, { useEffect, useState } from 'react';
import {
  Platform,
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
import * as Location from 'expo-location';
import SearchablePicker from '../../src/components/SearchablePicker';
import VehicleTypePicker from '../../src/components/VehicleTypePicker';
import { api } from '../../src/api/client';
import { colors, VEHICLE_TYPES, estimatePrice } from '../../src/constants/theme';

let MapView = null;
let Marker = null;

if (Platform.OS !== 'web') {
  const ReactNativeMaps = require('react-native-maps');
  MapView = ReactNativeMaps.default;
  Marker = ReactNativeMaps.Marker;
}

const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY_HERE';

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
];

export default function BookScreen() {
  const [step, setStep] = useState(1);
  const [vehicleType, setVehicle] = useState(null);
  const [pickup, setPickup] = useState({ address: '', lat: null, lng: null });
  const [delivery, setDelivery] = useState({ address: '', lat: null, lng: null });
  const [cargoType, setCargo] = useState('');
  const [weightKg, setWeight] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [scheduled, setScheduled] = useState(false);
  const [loading, setLoading] = useState(false);

  const updateAddress = async (lat, lng, setter) => {
    try {
      const [result] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const address = result
        ? `${result.name || result.street || ''}, ${result.city || ''}`.trim().replace(/^,/, '').trim()
        : 'Pinned Location';
      setter({ address: address || 'Unknown Location', lat, lng });
    } catch (_error) {
      setter({ address: 'Pinned Location', lat, lng });
    }
  };

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({});
      updateAddress(location.coords.latitude, location.coords.longitude, setPickup);
    })();
  }, []);

  const vehicle = VEHICLE_TYPES.find((item) => item.key === vehicleType);
  const estimate = estimatePrice(vehicleType, parseFloat(weightKg || 0));
  const fmt = (value) => Number(value).toLocaleString();

  const resetForm = () => {
    setStep(1);
    setVehicle(null);
    setPickup({ address: '', lat: null, lng: null });
    setDelivery({ address: '', lat: null, lng: null });
    setCargo('');
    setWeight('');
    setDescription('');
    setInstructions('');
    setScheduled(false);
  };

  const handleBook = async () => {
    setLoading(true);
    try {
      const data = await api.post('/api/v1/customer/bookings', {
        serviceType: 'COURIER',
        totalPrice: estimate,
        idempotencyKey: `bk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        stops: [
          {
            sequence: 1,
            address: pickup.address,
            latitude: pickup.lat,
            longitude: pickup.lng,
            stopType: 'PICKUP',
            contactName: 'Current User',
            contactPhone: 'N/A',
          },
          {
            sequence: 2,
            address: delivery.address,
            latitude: delivery.lat,
            longitude: delivery.lng,
            stopType: 'DELIVERY',
            contactName: 'Receiver',
            contactPhone: 'N/A',
          },
        ],
        cargoType,
        cargoWeightKg: parseFloat(weightKg) || null,
        cargoDescription: description,
        specialInstructions: instructions,
        isScheduled: scheduled,
      });

      Alert.alert(
        'Booking created',
        `Reference: ${data.data?.reference}\n\nAdmin will review and assign a driver.`,
        [{ text: 'OK', onPress: resetForm }]
      );
    } catch (requestError) {
      Alert.alert('Error', requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const getWeightLimit = (capacity) => {
    if (!capacity) return Infinity;
    const match = capacity.match(/(\d+)/);
    return match ? parseInt(match[1], 10) * (capacity.toLowerCase().includes('ton') ? 1000 : 1) : Infinity;
  };

  const isOverweight =
    vehicle && weightKg && parseFloat(weightKg) > getWeightLimit(vehicle.capacity);

  const canContinueToReview = pickup.lat && delivery.lat && !isOverweight;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.stepBar}>
        {[1, 2, 3].map((value) => (
          <View key={value} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[s.dot, step >= value && s.dotActive]}>
              <Text style={[s.dotNum, step >= value && s.dotNumActive]}>{step > value ? 'OK' : value}</Text>
            </View>
            {value < 3 ? <View style={[s.line, step > value && s.lineActive]} /> : null}
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {step === 1 ? (
          <>
            <Text style={s.stepTitle}>Select vehicle type</Text>
            <Text style={s.stepSub}>Choose the best fit for your cargo size and weight.</Text>
            <VehicleTypePicker vehicles={VEHICLE_TYPES} selectedType={vehicleType} onSelect={setVehicle} />
            <TouchableOpacity
              style={[s.btn, !vehicleType && s.btnDisabled]}
              onPress={() => vehicleType && setStep(2)}
              disabled={!vehicleType}>
              <Text style={s.btnText}>Continue</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={s.stepTitle}>Cargo and route</Text>
            <Text style={s.stepSub}>Pickup and delivery locations are required.</Text>
            <TouchableOpacity onPress={() => setStep(1)} style={s.back}>
              <Text style={s.backText}>Back</Text>
            </TouchableOpacity>

            <View style={s.mapContainer}>
              {MapView ? (
                <>
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
                    onLongPress={(event) => {
                      const { latitude, longitude } = event.nativeEvent.coordinate;
                      updateAddress(latitude, longitude, setDelivery);
                    }}>
                    {pickup.lat ? (
                      <Marker
                        draggable
                        coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
                        pinColor={colors.primary}
                        title="Pickup"
                        onDragEnd={(event) =>
                          updateAddress(
                            event.nativeEvent.coordinate.latitude,
                            event.nativeEvent.coordinate.longitude,
                            setPickup
                          )
                        }
                      />
                    ) : null}
                    {delivery.lat ? (
                      <Marker
                        draggable
                        coordinate={{ latitude: delivery.lat, longitude: delivery.lng }}
                        pinColor="#ff4444"
                        title="Delivery"
                        onDragEnd={(event) =>
                          updateAddress(
                            event.nativeEvent.coordinate.latitude,
                            event.nativeEvent.coordinate.longitude,
                            setDelivery
                          )
                        }
                      />
                    ) : null}
                  </MapView>
                  <Text style={s.mapHint}>Long press the map to set delivery and drag markers to adjust.</Text>
                </>
              ) : (
                <View style={s.webMapFallback}>
                  <Text style={s.webMapTitle}>Map preview is available on mobile devices.</Text>
                  <Text style={s.webMapText}>
                    Use the pickup and delivery search fields below when running the web build.
                  </Text>
                </View>
              )}
            </View>

            <Text style={s.label}>Pickup Location *</Text>
            <SearchablePicker
              placeholder="Search pickup address"
              onLocationSelect={setPickup}
              apiKey={GOOGLE_MAPS_API_KEY}
            />

            <Text style={s.label}>Delivery Location *</Text>
            <SearchablePicker
              placeholder="Search delivery address"
              onLocationSelect={setDelivery}
              apiKey={GOOGLE_MAPS_API_KEY}
            />

            {[
              { label: 'Cargo Type', value: cargoType, setValue: setCargo, placeholder: 'Electronics, furniture, parcels' },
              { label: 'Weight (kg)', value: weightKg, setValue: setWeight, placeholder: 'Approximate weight', numeric: true },
              { label: 'Description', value: description, setValue: setDescription, placeholder: 'Describe your cargo', multiline: true },
              {
                label: 'Special Instructions',
                value: instructions,
                setValue: setInstructions,
                placeholder: 'Fragile, handle with care',
                multiline: true,
              },
            ].map((field) => (
              <View key={field.label}>
                <Text style={s.label}>{field.label}</Text>
                <TextInput
                  style={[s.input, field.multiline && { height: 72 }]}
                  value={field.value}
                  onChangeText={field.setValue}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.textFaint}
                  keyboardType={field.numeric ? 'numeric' : 'default'}
                  multiline={!!field.multiline}
                />
              </View>
            ))}

            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Schedule for later</Text>
              <Switch
                value={scheduled}
                onValueChange={setScheduled}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <TouchableOpacity
              style={[s.btn, !canContinueToReview && s.btnDisabled]}
              onPress={() => {
                if (isOverweight) {
                  Alert.alert('Weight limit exceeded', `The selected vehicle carries max ${vehicle.capacity}.`);
                  return;
                }
                if (pickup.lat && delivery.lat) setStep(3);
              }}
              disabled={!canContinueToReview}>
              <Text style={s.btnText}>Review booking</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={s.stepTitle}>Review and confirm</Text>
            <TouchableOpacity onPress={() => setStep(2)} style={s.back}>
              <Text style={s.backText}>Back</Text>
            </TouchableOpacity>

            <View style={s.summaryCard}>
              {[
                ['Vehicle', vehicle?.label || vehicleType],
                ['Pickup', pickup.address],
                ['Delivery', delivery.address],
                cargoType ? ['Cargo', cargoType] : null,
                weightKg ? ['Weight', `${weightKg} kg`] : null,
              ]
                .filter(Boolean)
                .map(([label, value]) => (
                  <View key={label} style={s.summaryRow}>
                    <Text style={s.summaryLabel}>{label}</Text>
                    <Text style={s.summaryVal} numberOfLines={2}>
                      {value}
                    </Text>
                  </View>
                ))}
            </View>

            <View style={s.priceCard}>
              <Text style={s.priceLabel}>Estimated price</Text>
              <Text style={s.priceAmt}>KES {fmt(estimate)}</Text>
              <Text style={s.priceNote}>Final price is confirmed by admin. No hidden fees.</Text>
            </View>

            <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleBook} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.bg} /> : <Text style={s.btnText}>Confirm booking</Text>}
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  stepBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, paddingBottom: 8 },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotNum: { fontSize: 12, fontWeight: '700', color: colors.textFaint },
  dotNumActive: { color: colors.bg },
  line: { width: 50, height: 2, backgroundColor: colors.border },
  lineActive: { backgroundColor: colors.primary },
  content: { padding: 20, paddingBottom: 40 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 6 },
  stepSub: { fontSize: 13, color: colors.textMuted, marginBottom: 20 },
  label: { fontSize: 12, color: colors.textMuted, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    padding: 14,
    fontSize: 14,
  },
  mapContainer: {
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  map: { flex: 1 },
  mapHint: { fontSize: 10, color: colors.textFaint, textAlign: 'center', marginTop: 4 },
  webMapFallback: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  webMapTitle: { fontSize: 14, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 8 },
  webMapText: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  switchLabel: { fontSize: 14, color: colors.text },
  btn: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: colors.bg, fontSize: 16, fontWeight: '800' },
  back: { marginBottom: 16 },
  backText: { color: colors.textMuted, fontSize: 14 },
  summaryCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryLabel: { fontSize: 13, color: colors.textMuted, flex: 1 },
  summaryVal: { fontSize: 13, color: colors.text, flex: 2, textAlign: 'right', marginLeft: 12 },
  priceCard: {
    backgroundColor: colors.primary + '15',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  priceLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 6 },
  priceAmt: { fontSize: 32, fontWeight: '900', color: colors.primary },
  priceNote: { fontSize: 12, color: colors.textFaint, marginTop: 8, textAlign: 'center' },
});
