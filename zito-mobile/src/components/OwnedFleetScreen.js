'use client';

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { colors } from '../constants/theme';

const VEHICLE_OPTIONS = [
  { key: 'VAN', label: 'Van' },
  { key: 'TRUCK_3T', label: '3T Truck' },
  { key: 'TRUCK_7T', label: '7T Truck' },
  { key: 'TRUCK_14T', label: '14T Truck' },
  { key: 'TRUCK_22T', label: '22T Truck' },
  { key: 'REFRIGERATED', label: 'Refrigerated' },
  { key: 'MOTORBIKE', label: 'Motorbike' },
];

const INITIAL_FORM = {
  plateNumber: '',
  chassisNumber: '',
  make: '',
  model: '',
  year: '',
  type: 'VAN',
  capacityKg: '',
  capacityM3: '',
  insuranceCompany: '',
  insurancePolicyNumber: '',
  insuranceExpiry: '',
};

function isVehicleApproved(vehicle) {
  return (
    vehicle?.status === 'ACTIVE' &&
    String(vehicle?.verificationStatus || '').toUpperCase() === 'APPROVED'
  );
}

export function OwnedFleetScreen({ title, subtitle, feeNote, emptyText, children }) {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const load = async () => {
    try {
      const data = await api.get('/api/v1/fleet');
      setVehicles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      Alert.alert('Fleet error', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    if (
      !form.plateNumber ||
      !form.chassisNumber ||
      !form.make ||
      !form.model ||
      !form.year ||
      !form.capacityKg ||
      !form.capacityM3 ||
      !form.insuranceCompany ||
      !form.insurancePolicyNumber ||
      !form.insuranceExpiry
    ) {
      Alert.alert('Required', 'Complete the full fleet profile and insurance details first.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/api/v1/fleet', {
        plateNumber: form.plateNumber.trim().toUpperCase(),
        chassisNumber: form.chassisNumber.trim().toUpperCase(),
        make: form.make.trim(),
        model: form.model.trim(),
        year: Number(form.year),
        type: form.type,
        capacityKg: Number(form.capacityKg),
        capacityM3: Number(form.capacityM3),
        insuranceCompany: form.insuranceCompany.trim(),
        insurancePolicyNumber: form.insurancePolicyNumber.trim().toUpperCase(),
        insuranceExpiry: form.insuranceExpiry,
      });
      setShowAdd(false);
      setForm(INITIAL_FORM);
      load();
      Alert.alert('Saved', 'Vehicle added and sent for admin approval.');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRetire = async (vehicleId) => {
    try {
      await api.patch(`/api/v1/fleet/${vehicleId}/retire`, {});
      load();
      Alert.alert('Updated', 'Vehicle retired from active fleet.');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.subtitle}>{subtitle}</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={s.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={s.note}>
        <Text style={s.noteText}>{feeNote}</Text>
      </View>

      {children ? <View style={s.extra}>{children}</View> : null}

      <ScrollView
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {vehicles.length === 0 ? <Text style={s.empty}>{emptyText}</Text> : null}

        {vehicles.map((vehicle) => (
          <View key={vehicle.id} style={s.card}>
            <View style={s.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.plate}>{vehicle.plateNumber}</Text>
                <Text style={s.meta}>
                  {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ') ||
                    'Vehicle profile pending'}
                </Text>
                <Text style={s.meta}>Chassis: {vehicle.chassisNumber || 'Pending'}</Text>
              </View>
              <View
                style={[
                  s.pill,
                  {
                    backgroundColor: isVehicleApproved(vehicle)
                      ? `${colors.success}20`
                      : `${colors.warning}20`,
                  },
                ]}
              >
                <Text
                  style={[
                    s.pillText,
                    { color: isVehicleApproved(vehicle) ? colors.success : colors.warning },
                  ]}
                >
                  {isVehicleApproved(vehicle) ? 'APPROVED' : 'PENDING'}
                </Text>
              </View>
            </View>
            <Text style={s.type}>
              {vehicle.type} · {vehicle.capacityKg} kg
              {vehicle.capacityM3 ? ` · ${vehicle.capacityM3} m3` : ''}
            </Text>
            <Text style={s.meta}>
              Insurance: {vehicle.insuranceCompany || 'Pending'}
              {vehicle.insuranceExpiry ? ` · expires ${vehicle.insuranceExpiry.slice(0, 10)}` : ''}
            </Text>
            <Text style={s.meta}>
              Verification: {vehicle.verificationStatus || 'PENDING_REVIEW'}
            </Text>
            <Text style={s.meta}>
              Bookings: {vehicle._count?.bookings || 0} · Breakdowns: {vehicle._count?.breakdowns || 0}
            </Text>
            {!isVehicleApproved(vehicle) ? (
              <Text style={s.pendingNote}>
                Pending admin approval. Fresh camera photos, insurance evidence, and GPS setup must be completed first.
              </Text>
            ) : null}
            {isVehicleApproved(vehicle) ? (
              <TouchableOpacity style={s.retireBtn} onPress={() => handleRetire(vehicle.id)}>
                <Text style={s.retireBtnText}>Retire vehicle</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <Modal
        visible={showAdd}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAdd(false)}
      >
        <SafeAreaView style={s.modal}>
          <View style={s.modalHead}>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Text style={s.close}>×</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>Add Vehicle</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView style={s.modalBody}>
            {[
              { key: 'plateNumber', label: 'Plate Number *', placeholder: 'KDA 123A' },
              { key: 'chassisNumber', label: 'Chassis Number *', placeholder: 'CHS-00123' },
              { key: 'make', label: 'Make *', placeholder: 'Toyota' },
              { key: 'model', label: 'Model *', placeholder: 'Hiace' },
              { key: 'year', label: 'Year *', placeholder: '2024', numeric: true },
              { key: 'capacityKg', label: 'Capacity (kg) *', placeholder: '1500', numeric: true },
              { key: 'capacityM3', label: 'Capacity (m3) *', placeholder: '12', numeric: true },
              {
                key: 'insuranceCompany',
                label: 'Insurance Company *',
                placeholder: 'Jubilee Insurance',
              },
              {
                key: 'insurancePolicyNumber',
                label: 'Policy Number *',
                placeholder: 'POL-90876',
              },
              {
                key: 'insuranceExpiry',
                label: 'Insurance Expiry *',
                placeholder: '2026-12-31',
              },
            ].map((field) => (
              <View key={field.key}>
                <Text style={s.label}>{field.label}</Text>
                <TextInput
                  style={s.input}
                  value={form[field.key]}
                  onChangeText={(value) =>
                    setForm((current) => ({ ...current, [field.key]: value }))
                  }
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.textFaint}
                  keyboardType={field.numeric ? 'numeric' : 'default'}
                  autoCapitalize={
                    field.key === 'plateNumber' ||
                    field.key === 'chassisNumber' ||
                    field.key === 'insurancePolicyNumber'
                      ? 'characters'
                      : 'words'
                  }
                />
              </View>
            ))}

            <Text style={s.label}>Vehicle Type *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={s.typeRow}>
                {VEHICLE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[s.typeChip, form.type === option.key && s.typeChipActive]}
                    onPress={() => setForm((current) => ({ ...current, type: option.key }))}
                  >
                    <Text
                      style={[
                        s.typeChipText,
                        form.type === option.key && { color: colors.primary },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={s.cameraNote}>
              Verification photos must be captured fresh from the camera during the inspection stage: number plate, front, right, left, back, chassis, and insurance evidence.
            </Text>

            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.6 }]}
              disabled={saving}
              onPress={handleAdd}
            >
              {saving ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={s.saveBtnText}>Save Vehicle</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 8,
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 6, lineHeight: 20 },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addBtnText: { color: colors.bg, fontWeight: '800', fontSize: 13 },
  note: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    padding: 12,
  },
  noteText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  extra: { paddingHorizontal: 16, paddingTop: 12 },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  empty: {
    textAlign: 'center',
    color: colors.textFaint,
    marginTop: 40,
    fontSize: 14,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  plate: { fontSize: 17, fontWeight: '800', color: colors.text },
  type: { fontSize: 13, color: colors.text, marginTop: 10 },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 10, fontWeight: '700' },
  pendingNote: { marginTop: 10, fontSize: 12, lineHeight: 18, color: colors.warning },
  retireBtn: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 10,
    alignItems: 'center',
  },
  retireBtnText: { color: colors.danger, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  close: { color: colors.textMuted, fontSize: 24 },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  modalBody: { padding: 20 },
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
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: { borderColor: colors.primary },
  typeChipText: { color: colors.textMuted, fontWeight: '600' },
  cameraNote: { marginTop: 18, fontSize: 12, lineHeight: 18, color: colors.textMuted },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  saveBtnText: { color: colors.bg, fontWeight: '800', fontSize: 15 },
});
