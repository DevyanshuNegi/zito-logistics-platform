/**
 * DateInput Component
 * Provides native date picker for both iOS and Android
 * Enforces DD/MM/YYYY format
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  DatePickerAndroid,
  Alert,
  TextInput,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { colors, spacing, radius } from '../constants/theme';
import { formatDateDMY, parseDateDMY } from '../utils/dateFormat';

export const DateInput = ({
  label,
  value,
  onDateChange,
  minimumDate,
  maximumDate,
  placeholder = 'DD/MM/YYYY',
  disabled = false,
  required = false,
  icon = '📅',
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(value ? new Date(value) : new Date());
  const [manualInput, setManualInput] = useState(value ? formatDateDMY(value) : '');

  const handleManualInput = (text) => {
    setManualInput(text);

    // Only accept DD/MM/YYYY format
    if (text.length === 10) {
      const parsed = parseDateDMY(text);
      if (parsed) {
        // Validate range
        if (minimumDate && parsed < new Date(minimumDate)) {
          Alert.alert('Invalid Date', `Date cannot be before ${formatDateDMY(minimumDate)}`);
          setManualInput(manualInput); // Reset
          return;
        }
        if (maximumDate && parsed > new Date(maximumDate)) {
          Alert.alert('Invalid Date', `Date cannot be after ${formatDateDMY(maximumDate)}`);
          setManualInput(manualInput); // Reset
          return;
        }

        setTempDate(parsed);
        onDateChange(parsed);
      } else {
        Alert.alert('Invalid Format', 'Please use DD/MM/YYYY format');
        setManualInput(manualInput); // Reset
      }
    }
  };

  const openAndroidDatePicker = async () => {
    try {
      const { action, year, month, day } = await DatePickerAndroid.open({
        date: tempDate,
        minDate: minimumDate ? new Date(minimumDate) : new Date(1900, 0, 1),
        maxDate: maximumDate ? new Date(maximumDate) : new Date(2100, 11, 31),
      });

      if (action === DatePickerAndroid.dateSetAction) {
        const newDate = new Date(year, month, day);
        setTempDate(newDate);
        const formatted = formatDateDMY(newDate);
        setManualInput(formatted);
        onDateChange(newDate);
      }
    } catch (e) {
      console.warn('DatePickerAndroid error:', e);
    }
  };

  const handleIOSDateChange = (day, month, year) => {
    const newDate = new Date(year, month - 1, day);
    
    // Check ranges
    if (minimumDate && newDate < new Date(minimumDate)) {
      Alert.alert('Invalid Date', `Date cannot be before ${formatDateDMY(minimumDate)}`);
      return;
    }
    if (maximumDate && newDate > new Date(maximumDate)) {
      Alert.alert('Invalid Date', `Date cannot be after ${formatDateDMY(maximumDate)}`);
      return;
    }

    setTempDate(newDate);
    const formatted = formatDateDMY(newDate);
    setManualInput(formatted);
    onDateChange(newDate);
    setShowPicker(false);
  };

  const handlePress = () => {
    if (disabled) return;

    if (Platform.OS === 'android') {
      openAndroidDatePicker();
    } else {
      setShowPicker(true);
    }
  };

  // iOS picker wheel renderer
  const renderIOSPickerWheels = () => {
    const currentDay = tempDate.getDate();
    const currentMonth = tempDate.getMonth() + 1;
    const currentYear = tempDate.getFullYear();

    const days = Array.from({ length: 31 }, (_, i) => i + 1);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const years = Array.from({ length: 100 }, (_, i) => 2000 + i);

    return (
      <View style={s.iosPickerContainer}>
        <View style={s.iosPickerHeader}>
          <Text style={s.iosPickerTitle}>Select Date</Text>
          <TouchableOpacity onPress={() => setShowPicker(false)}>
            <Text style={s.iosPickerClose}>✕</Text>
          </TouchableOpacity>
        </View>
        
        <View style={s.iosPickerWheels}>
          {/* Day Picker */}
          <ScrollView
            style={s.iosPickerWheel}
            showsVerticalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const offset = e.nativeEvent.contentOffset.y;
              const day = Math.round(offset / 40) + 1;
              if (day >= 1 && day <= 31) handleIOSDateChange(day, currentMonth, currentYear);
            }}>
            {days.map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => handleIOSDateChange(d, currentMonth, currentYear)}>
                <Text style={[s.iosPickerOption, currentDay === d && s.iosPickerOptionActive]}>
                  {String(d).padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.iosPickerSeparator}>/</Text>

          {/* Month Picker */}
          <ScrollView
            style={s.iosPickerWheel}
            showsVerticalScrollIndicator={false}>
            {months.map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => handleIOSDateChange(currentDay, m, currentYear)}>
                <Text style={[s.iosPickerOption, currentMonth === m && s.iosPickerOptionActive]}>
                  {String(m).padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.iosPickerSeparator}>/</Text>

          {/* Year Picker */}
          <ScrollView
            style={s.iosPickerWheel}
            showsVerticalScrollIndicator={false}>
            {years.map((y) => (
              <TouchableOpacity
                key={y}
                onPress={() => handleIOSDateChange(currentDay, currentMonth, y)}>
                <Text style={[s.iosPickerOption, currentYear === y && s.iosPickerOptionActive]}>
                  {y}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity style={s.iosDoneBtn} onPress={() => setShowPicker(false)}>
          <Text style={s.iosDoneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={s.container}>
      {label && (
        <Text style={s.label}>
          {icon} {label}
          {required && <Text style={s.required}> *</Text>}
        </Text>
      )}

      <TouchableOpacity
        style={[s.inputWrapper, disabled && s.disabled]}
        onPress={handlePress}
        disabled={disabled}>
        <TextInput
          style={s.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={manualInput}
          onChangeText={handleManualInput}
          editable={!disabled}
          maxLength={10}
          keyboardType="decimal-pad"
        />
        <Text style={s.icon}>📅</Text>
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPicker(false)}>
          <View style={s.iosModalOverlay}>
            {renderIOSPickerWheels()}
          </View>
        </Modal>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  required: {
    color: colors.danger,
    fontWeight: '800',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  disabled: {
    opacity: 0.5,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
    padding: 0,
  },
  icon: {
    fontSize: 18,
    marginLeft: spacing.sm,
  },
  iosModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
  },
  iosPickerContainer: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing.xl,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iosPickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  iosPickerClose: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textMuted,
  },
  iosPickerWheels: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  iosPickerWheel: {
    width: 60,
    maxHeight: 200,
  },
  iosPickerOption: {
    fontSize: 16,
    color: colors.textMuted,
    paddingVertical: spacing.md,
    textAlign: 'center',
    fontWeight: '500',
  },
  iosPickerOptionActive: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 18,
  },
  iosPickerSeparator: {
    fontSize: 20,
    color: colors.textMuted,
    fontWeight: '700',
  },
  iosDoneBtn: {
    backgroundColor: colors.primary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  iosDoneBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default DateInput;
