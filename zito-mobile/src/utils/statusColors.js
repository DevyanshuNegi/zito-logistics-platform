import React from 'react';
import { StyleSheet } from 'react-native';
import { colors } from '../constants/theme';

/**
 * Enhanced StatusBadge with color coding
 * Green for success, Amber for warning, Red for error
 */
export const getStatusColor = (status) => {
  const statusColorMap = {
    // Success states
    'completed': '#4CAF50',
    'delivered': '#4CAF50',
    'approved': '#4CAF50',
    
    // Warning states
    'pending': '#FF9500',
    'searching': '#FF9500',
    'assigned': '#FF9500',
    'accepted': '#FF9500',
    'picked_up': '#FF9500',
    'in_transit': '#FF9500',
    
    // Error/Alert states
    'cancelled': '#FF5252',
    'failed': '#FF5252',
    'rejected': '#FF5252',
    'delayed': '#FF5252',
    
    // Default
    default: colors.primary,
  };
  
  return statusColorMap[status] || statusColorMap.default;
};

export const getStatusLabel = (status) => {
  const labelMap = {
    'pending': 'Pending',
    'searching': 'Searching',
    'assigned': 'Driver Assigned',
    'accepted': 'En Route',
    'picked_up': 'Picked Up',
    'in_transit': 'In Transit',
    'delivered': 'Delivered',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'failed': 'Failed',
    'rejected': 'Rejected',
  };
  
  return labelMap[status] || status;
};

/**
 * Color-coded status indicator
 */
export const StatusColorCode = (status) => {
  const color = getStatusColor(status);
  
  return {
    backgroundColor: color + '20', // 20% opacity
    borderColor: color,
    textColor: color,
  };
};
