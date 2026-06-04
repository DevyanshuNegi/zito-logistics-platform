import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator, Dimensions } from 'react-native';
import { colors } from '../constants/theme';

const { width, height } = Dimensions.get('window');

/**
 * MapTrackingView - Full screen map with route visualization
 * Renders Google Maps with route polyline and markers
 * Falls back to minimal view if maps not available
 */
export const MapTrackingView = ({ 
  pickupLat, 
  pickupLng, 
  deliveryLat, 
  deliveryLng, 
  driverLat, 
  driverLng,
  eta,
  loading 
}) => {
  const mapRef = useRef(null);

  // For now, return a placeholder map view
  // In production, this would integrate react-native-maps
  return (
    <View style={s.container}>
      {/* Map area - placeholder */}
      <View style={s.mapPlaceholder}>
        <View style={s.mapContent}>
          <Text style={s.mapPlaceholderIcon}>🗺️</Text>
          <Text style={s.mapPlaceholderText}>Map Integration Ready</Text>
          <Text style={s.mapPlaceholderSub}>Google Maps will display here</Text>
          
          {/* Route summary */}
          <View style={s.routeSummary}>
            <View style={s.routePoint}>
              <Text style={s.pointEmoji}>📍</Text>
              <Text style={s.pointText}>Pickup</Text>
            </View>
            <Text style={s.routeConnector}>↓↓↓</Text>
            <View style={s.routePoint}>
              <Text style={s.pointEmoji}>🚛</Text>
              <Text style={s.pointText}>In Transit</Text>
            </View>
            <Text style={s.routeConnector}>↓↓↓</Text>
            <View style={s.routePoint}>
              <Text style={s.pointEmoji}>🏁</Text>
              <Text style={s.pointText}>Delivery</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ETA Overlay */}
      {eta && (
        <View style={s.etaOverlay}>
          <View style={s.etaBadge}>
            <Text style={s.etaEmoji}>🕐</Text>
            <View>
              <Text style={s.etaLabel}>Arriving Today</Text>
              <Text style={s.etaTime}>{eta}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Loading indicator */}
      {loading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    height: 280,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapContent: {
    alignItems: 'center',
  },
  mapPlaceholderIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  mapPlaceholderText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  mapPlaceholderSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 20,
  },
  routeSummary: {
    alignItems: 'center',
    gap: 6,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pointEmoji: {
    fontSize: 18,
  },
  pointText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  routeConnector: {
    fontSize: 10,
    color: colors.border,
  },
  etaOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  etaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  etaEmoji: {
    fontSize: 20,
  },
  etaLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  etaTime: {
    fontSize: 14,
    color: 'white',
    fontWeight: '800',
    marginTop: 2,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
});
