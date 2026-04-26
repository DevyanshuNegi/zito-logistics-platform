import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';

const VehicleTypePicker = ({ vehicles, selectedType, onSelect }) => {
  const fmt = v => Number(v).toLocaleString();

  return (
    <>
      {vehicles.map(v => (
        <TouchableOpacity 
          key={v.key} 
          style={[s.vehicleCard, selectedType === v.key && s.vehicleCardActive]} 
          onPress={() => onSelect(v.key)}
        >
          <Text style={s.vehicleIcon}>{v.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.vehicleName}>{v.label}</Text>
            <Text style={s.vehicleCap}>Max {v.capacity}</Text>
            <Text style={s.vehiclePrice}>From KES {fmt(v.base)} · KES {v.perKm}/km</Text>
          </View>
          {selectedType === v.key && <Text style={s.check}>✓</Text>}
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
    gap: 14 
  },
  vehicleCardActive:{ borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  vehicleIcon: { fontSize: 32 },
  vehicleName: { fontSize: 15, fontWeight: '700', color: colors.text },
  vehicleCap:  { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  vehiclePrice:{ fontSize: 12, color: colors.primary, marginTop: 2 },
  check:       { fontSize: 20, color: colors.primary, fontWeight: '800' },
});

export default VehicleTypePicker;