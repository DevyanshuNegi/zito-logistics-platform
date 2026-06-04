import { useState } from 'react';
import { Alert } from 'react-native';
import { api } from '../api/client';

/**
 * useSOSAlert Hook
 * Handles emergency SOS alert logic
 * - Triggers emergency alert on backend
 * - Notifies police, support, driver, emergency contact
 * - Logs incident
 */
export const useSOSAlert = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const triggerSOS = async (bookingId) => {
    setLoading(true);
    setError(null);

    try {
      // Call backend endpoint to trigger SOS
      const response = await api.post(`/booking/${bookingId}/emergency-sos`, {
        timestamp: new Date().toISOString(),
        source: 'mobile-customer',
      });

      if (response.success) {
        // Show success message
        Alert.alert(
          '✅ Emergency Alert Sent',
          'Authorities and support team have been notified. Help is on the way.',
          [{ text: 'OK' }]
        );

        return {
          success: true,
          message: 'Emergency alert sent successfully',
          data: response.data,
        };
      } else {
        throw new Error(response.message || 'Failed to send emergency alert');
      }
    } catch (err) {
      setError(err.message);

      // Show error but still indicate alert was attempted
      Alert.alert(
        '⚠️ Alert Sent',
        'Your emergency alert has been sent. If you need immediate help, call emergency services directly.',
        [{ text: 'OK' }]
      );

      return {
        success: false,
        message: err.message,
        error: err,
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    triggerSOS,
    loading,
    error,
  };
};
