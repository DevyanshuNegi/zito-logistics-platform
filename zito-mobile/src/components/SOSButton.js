import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Text } from 'react-native';
import { useSOSAlert } from '../hooks/useSOSAlert';
import { colors } from '../constants/theme';

/**
 * SOSButton Component
 * Emergency button for customer safety
 * - Red prominent button with SOS text
 * - Confirmation popup before triggering
 * - Shows loading state while sending alert
 */
export const SOSButton = ({ bookingId, onSuccess }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const { triggerSOS, loading } = useSOSAlert();

  const handleSOSPress = () => {
    Alert.alert(
      '🆘 Emergency Alert',
      'Are you in immediate danger? This will alert:\n\n• Emergency services\n• ZITO support team\n• Your driver\n• Your emergency contact\n\nOnly tap if you need urgent help.',
      [
        {
          text: 'Cancel',
          onPress: () => setShowConfirm(false),
          style: 'cancel',
        },
        {
          text: 'YES - HELP NOW',
          onPress: async () => {
            const result = await triggerSOS(bookingId);
            if (result.success) {
              onSuccess?.();
            }
          },
          style: 'destructive',
        },
      ],
      { cancelable: false }
    );
  };

  return (
    <TouchableOpacity
      style={[s.button, loading && s.loading]}
      onPress={handleSOSPress}
      disabled={loading}
      activeOpacity={0.8}>
      {loading ? (
        <ActivityIndicator color="white" size="small" />
      ) : (
        <Text style={s.text}>🆘 SOS</Text>
      )}
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  button: {
    flex: 1,
    backgroundColor: '#FF3333',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    shadowColor: '#FF3333',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  text: {
    color: 'white',
    fontWeight: '700',
    fontSize: 13,
  },
  loading: {
    opacity: 0.7,
  },
});
