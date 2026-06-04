// app/(customer)/book-modern.js — Modern Booking Screen with Interactive Map & Location Search
// PRD 3.1 - Customer booking with modern Uber/Bolt-like UX
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
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';

import { LocationSearchInput } from '../../src/components/LocationSearchInput';
import VehicleTypePicker from '../../src/components/VehicleTypePicker';
import { DateInput } from '../../src/components/DateInput';
import { CustomerAiSupportSheet } from '../../src/components/CustomerAiSupportSheet';
import { api, extractErrorMessage } from '../../src/api/client';
import { colors, VEHICLE_TYPES, estimatePrice, spacing, radius, shadows } from '../../src/constants/theme';
import { formatDateForAPI } from '../../src/utils/dateFormat';

const VEHICLE_TYPE_API_MAP = {
  motorcycle: 'MOTORBIKE',
  pickup: 'VAN',
  van: 'VAN',
  light_truck: 'TRUCK_3T',
  heavy_truck: 'TRUCK_7T',
};

function createUuid() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export default function BookScreenModern() {
  const router = useRouter();
  const [vehicleType, setVehicleType] = useState(null);
  const [pickup, setPickup] = useState({ address: '', lat: -1.2921, lng: 36.8219 });
  const [delivery, setDelivery] = useState({ address: '', lat: null, lng: null });
  const [cargoType, setCargoType] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [scheduled, setScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [expandCargo, setExpandCargo] = useState(false);
  const [recentLocations, setRecentLocations] = useState([]);

  // Get current location on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      try {
        const location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;
        
        // Reverse geocode to get address
        try {
          const [result] = await Location.reverseGeocodeAsync({ latitude, longitude });
          const address = result
            ? `${result.name || result.street || ''}, ${result.city || ''}`.trim()
            : 'Current Location';
          setPickup({ address, lat: latitude, lng: longitude });
        } catch (_) {
          setPickup({ address: 'Current Location', lat: latitude, lng: longitude });
        }
      } catch (_) {
        // Use default Nairobi location
      }
    })();
  }, []);

  const vehicle = VEHICLE_TYPES.find((item) => item.key === vehicleType);
  const estimate = estimatePrice(vehicleType, parseFloat(weightKg || 0));

  const handleSwapLocations = () => {
    if (!delivery.lat) {
      Alert.alert('Swap Error', 'Set delivery location first.');
      return;
    }
    const temp = pickup;
    setPickup(delivery);
    setDelivery(temp);
  };

  const handleBook = async () => {
    // Validation
    if (!vehicle) {
      Alert.alert('Vehicle Required', 'Please select a vehicle type.');
      return;
    }
    if (!pickup.lat || !delivery.lat) {
      Alert.alert('Locations Required', 'Please set both pickup and delivery locations.');
      return;
    }
    if (!estimate || estimate <= 0) {
      Alert.alert('Invalid Price', 'Estimated price is invalid.');
      return;
    }
    if (scheduled && !scheduledDate) {
      Alert.alert('Scheduled Date Required', 'Please select a date for scheduled booking.');
      return;
    }

    setLoading(true);
    try {
      const bookingData = await api.post('/customer/bookings', {
        serviceType: 'COURIER',
        vehicleType: VEHICLE_TYPE_API_MAP[vehicleType] || 'VAN',
        totalPrice: estimate,
        idempotencyKey: createUuid(),
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
        scheduledDate: scheduled ? formatDateForAPI(scheduledDate) : null,
      });

      // Add to recent locations
      setRecentLocations([
        ...recentLocations,
        { address: pickup.address, lat: pickup.lat, lng: pickup.lng },
        { address: delivery.address, lat: delivery.lat, lng: delivery.lng },
      ].slice(-5));

      Alert.alert(
        '✅ Booking Created',
        `Reference: ${bookingData.data?.reference}\n\nAdmin will review and assign a driver shortly.`,
        [{ text: 'Track Booking', onPress: () => router.push('/(customer)/track') }]
      );
    } catch (err) {
      Alert.alert('Booking Error', extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const isComplete = vehicleType && pickup.lat && delivery.lat && (estimate > 0) && (!scheduled || scheduledDate);

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.flex}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.headerLogo}>⚡</Text>
            <Text style={s.headerTitle}>Quick Booking</Text>
          </View>
          <TouchableOpacity onPress={() => setShowAssistant(true)} style={s.helpBtn}>
            <Text style={s.helpText}>?</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Step 1: Locations */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>📍 Where are we going?</Text>
            
            {/* Location Search Inputs */}
            <View style={s.locationSearches}>
              <LocationSearchInput
                placeholder="Pickup location"
                value={pickup.address}
                onSelect={(loc) => setPickup(loc)}
                icon="📍"
                recentLocations={recentLocations}
                showRecent={true}
              />

              {/* Swap Button */}
              <TouchableOpacity style={s.swapBtn} onPress={handleSwapLocations}>
                <Text style={s.swapIcon}>⇅</Text>
              </TouchableOpacity>

              <LocationSearchInput
                placeholder="Delivery location"
                value={delivery.address}
                onSelect={(loc) => setDelivery(loc)}
                icon="🏁"
                recentLocations={recentLocations}
                showRecent={true}
              />
            </View>

            {/* Map Preview */}
            {pickup.lat && delivery.lat && (
              <View style={s.mapContainer}>
                <View style={s.routePreviewGrid}>
                  <View style={[s.routeNode, s.pickupNode]}>
                    <Text style={s.routeNodeText}>P</Text>
                  </View>
                  <View style={s.routeLine} />
                  <View style={[s.routeNode, s.deliveryNode]}>
                    <Text style={s.routeNodeText}>D</Text>
                  </View>
                </View>
                <View style={s.routePreviewOverlay}>
                  <Text style={s.routePreviewTitle}>Route Preview</Text>
                  <Text style={s.routePreviewText} numberOfLines={1}>{pickup.address}</Text>
                  <Text style={s.routePreviewText} numberOfLines={1}>{delivery.address}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Step 2: Vehicle Type */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>🚗 Vehicle Type</Text>
            <VehicleTypePicker
              vehicles={VEHICLE_TYPES}
              selectedType={vehicleType}
              onSelect={setVehicleType}
            />
          </View>

          {/* Step 3: Cargo Details (Collapsible) */}
          <TouchableOpacity
            style={[s.section, s.cargoHeader]}
            onPress={() => setExpandCargo(!expandCargo)}>
            <View style={s.cargoHeaderContent}>
              <Text style={s.sectionTitle}>📦 Cargo Details</Text>
              <Text style={s.collapseIcon}>{expandCargo ? '▼' : '▶'}</Text>
            </View>
          </TouchableOpacity>

          {expandCargo && (
            <View style={[s.section, s.sectionNoPad]}>
              {/* Cargo Type */}
              <View style={s.formGroup}>
                <Text style={s.label}>Type</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g., Electronics, furniture, parcels"
                  placeholderTextColor={colors.textMuted}
                  value={cargoType}
                  onChangeText={setCargoType}
                />
              </View>

              {/* Weight */}
              <View style={s.formGroup}>
                <Text style={s.label}>Weight (kg)</Text>
                <TextInput
                  style={s.input}
                  placeholder="Approximate weight"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  value={weightKg}
                  onChangeText={setWeightKg}
                />
                {vehicle && weightKg && (
                  <Text style={s.weightHint}>
                    Capacity: {vehicle.capacity} | Status: {parseFloat(weightKg) > parseInt(vehicle.capacity) ? '⚠️ Overweight' : '✓ OK'}
                  </Text>
                )}
              </View>

              {/* Description */}
              <View style={s.formGroup}>
                <Text style={s.label}>Description</Text>
                <TextInput
                  style={[s.input, s.textArea]}
                  placeholder="Additional details about the cargo"
                  placeholderTextColor={colors.textMuted}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Special Instructions */}
              <View style={s.formGroup}>
                <Text style={s.label}>Special Instructions</Text>
                <TextInput
                  style={[s.input, s.textArea]}
                  placeholder="e.g., Handle with care, fragile, refrigerate, etc."
                  placeholderTextColor={colors.textMuted}
                  value={instructions}
                  onChangeText={setInstructions}
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Schedule */}
              <View style={s.formGroup}>
                <View style={s.scheduleRow}>
                  <Text style={s.label}>Schedule for later</Text>
                  <Switch
                    value={scheduled}
                    onValueChange={setScheduled}
                    trackColor={{ false: colors.border, true: colors.primary + '50' }}
                    thumbColor={scheduled ? colors.primary : colors.textMuted}
                  />
                </View>
              </View>

              {/* Scheduled Date Picker (only show if scheduled) */}
              {scheduled && (
                <View style={s.formGroup}>
                  <DateInput
                    label="Pickup Date"
                    value={scheduledDate}
                    onDateChange={setScheduledDate}
                    minimumDate={new Date()}
                    icon="📅"
                    required={true}
                    placeholder="DD/MM/YYYY"
                  />
                </View>
              )}
            </View>
          )}

          {/* Price Estimate */}
          {estimate > 0 && (
            <View style={s.priceCard}>
              <View style={s.priceRow}>
                <Text style={s.priceLabel}>Estimated Price:</Text>
                <Text style={s.priceValue}>KES {estimate.toLocaleString()}</Text>
              </View>
              <Text style={s.priceNote}>Price may vary based on distance and demand</Text>
            </View>
          )}
        </ScrollView>

        {/* Sticky Book Button */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.bookBtn, !isComplete && s.bookBtnDisabled]}
            onPress={handleBook}
            disabled={!isComplete || loading}>
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <>
                <Text style={s.bookBtnText}>Book Now</Text>
                {estimate > 0 && <Text style={s.bookBtnPrice}>KES {estimate.toLocaleString()}</Text>}
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <CustomerAiSupportSheet
        visible={showAssistant}
        onClose={() => setShowAssistant(false)}
        screenContext="CUSTOMER_BOOKING"
        title="Booking Help"
        description="Get help with vehicle selection, pricing, or booking process."
        quickActions={[
          { label: 'Vehicle choice', message: 'Help me choose the right vehicle for my delivery.' },
          { label: 'Pricing info', message: 'Explain how booking pricing is estimated.' },
          { label: 'How to book', message: 'Show me how to complete this booking correctly.' },
          { label: 'Delivery timeline', message: 'Explain what happens after I create a booking.' },
        ]}
        placeholder="Ask about vehicle types, pricing, or how to book."
        helpText="Zito Assistant helps you navigate the booking process smoothly."
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLogo: {
    fontSize: 24,
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  helpBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  helpText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    paddingBottom: 160,
  },
  section: {
    marginBottom: spacing.xl,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  sectionNoPad: {
    padding: 0,
    marginTop: -spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  locationSearches: {
    gap: spacing.md,
  },
  swapBtn: {
    alignSelf: 'center',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.sm,
    ...shadows.lg,
  },
  swapIcon: {
    fontSize: 22,
    color: '#fff',
    fontWeight: '700',
  },
  mapContainer: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    height: 200,
    borderWidth: 1,
    borderColor: 'rgba(18,200,255,0.30)',
    backgroundColor: '#07111f',
  },
  routePreviewGrid: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 34,
  },
  routeLine: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#12c8ff',
    shadowColor: '#12c8ff',
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  routeNode: {
    position: 'absolute',
    top: 72,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    zIndex: 2,
  },
  pickupNode: {
    left: 26,
    backgroundColor: '#12c8ff',
  },
  deliveryNode: {
    right: 26,
    backgroundColor: '#b13cff',
  },
  routeNodeText: {
    color: '#fff',
    fontWeight: '900',
  },
  routePreviewOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(2,5,12,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(18,200,255,0.24)',
  },
  routePreviewTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  routePreviewText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  cargoHeader: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cargoHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collapseIcon: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  textArea: {
    minHeight: 80,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  weightHint: {
    fontSize: 12,
    color: colors.textFaint,
    marginTop: spacing.sm,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceCard: {
    backgroundColor: colors.primary + '15',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  priceNote: {
    fontSize: 12,
    color: colors.textFaint,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bookBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  bookBtnDisabled: {
    opacity: 0.5,
  },
  bookBtnText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '800',
  },
  bookBtnPrice: {
    color: colors.bg,
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
});
