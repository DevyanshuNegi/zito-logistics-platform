import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../constants/theme';

const VehicleTypePicker = ({ vehicles, selectedType, onSelect }) => {
  const fmt = (value) => Number(value).toLocaleString();

  return (
    <>
      {vehicles.map((vehicle) => (
        <TouchableOpacity
          key={vehicle.key}
          style={[s.vehicleCard, selectedType === vehicle.key && s.vehicleCardActive]}
          onPress={() => onSelect(vehicle.key)}>
          <View style={s.vehicleIconWrap}>
            <MaterialCommunityIcons name={vehicle.icon} size={28} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.vehicleName}>{vehicle.label}</Text>
            <Text style={s.vehicleCap}>Max {vehicle.capacity}</Text>
            <Text style={s.vehiclePrice}>
              From KES {fmt(vehicle.base)} - KES {vehicle.perKm}/km
            </Text>
          </View>
          {selectedType === vehicle.key ? <Text style={s.check}>OK</Text> : null}
        </TouchableOpacity>
      ))}
    </>
  );
};

const s = StyleSheet.create({
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.border,
    gap: 14,
  },
  vehicleCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  vehicleIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleName: { fontSize: 15, fontWeight: '700', color: colors.text },
  vehicleCap: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  vehiclePrice: { fontSize: 12, color: colors.primary, marginTop: 2 },
  check: { fontSize: 12, color: colors.primary, fontWeight: '800' },
});

export default VehicleTypePicker;
