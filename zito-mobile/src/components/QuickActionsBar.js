import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../constants/theme';

/**
 * QuickActionsBar - 3 circular action buttons for quick access
 * Reference: Schedule Pickup, Calculate Cost, Find Drop-off
 */
export const QuickActionsBar = ({ onSchedule, onCalculate, onFindDropoff, onChat }) => {
  return (
    <View style={s.container}>
      <Text style={s.title}>Quick Actions</Text>
      <View style={s.grid}>
        <TouchableOpacity style={s.action} onPress={onSchedule}>
          <View style={s.actionCircle}>
            <Text style={s.actionIcon}>📅</Text>
          </View>
          <Text style={s.actionLabel}>Schedule</Text>
          <Text style={s.actionSub}>Pickup</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.action} onPress={onCalculate}>
          <View style={s.actionCircle}>
            <Text style={s.actionIcon}>🧮</Text>
          </View>
          <Text style={s.actionLabel}>Calculate</Text>
          <Text style={s.actionSub}>Cost</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.action} onPress={onFindDropoff}>
          <View style={s.actionCircle}>
            <Text style={s.actionIcon}>📍</Text>
          </View>
          <Text style={s.actionLabel}>Find</Text>
          <Text style={s.actionSub}>Drop-off</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.action} onPress={onChat}>
          <View style={s.actionCircle}>
            <Text style={s.actionIcon}>💬</Text>
          </View>
          <Text style={s.actionLabel}>Chat</Text>
          <Text style={s.actionSub}>Support</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  action: {
    flex: 1,
    alignItems: 'center',
  },
  actionCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionIcon: {
    fontSize: 28,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  actionSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
});
