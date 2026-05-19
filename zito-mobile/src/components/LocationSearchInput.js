// src/components/LocationSearchInput.js
// Modern location search with autocomplete and recent locations
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Keyboard,
} from 'react-native';
import { colors, spacing, radius, shadows, typography } from '../constants/theme';

// Mock location suggestions - replace with actual Google Places API
const MOCK_SUGGESTIONS = {
  'nai': [
    { address: 'Nairobi Central, Kenya', lat: -1.2921, lng: 36.8219, type: 'city' },
    { address: 'Nairobi Westlands, Kenya', lat: -1.2671, lng: 36.8027, type: 'area' },
    { address: 'Nairobi Airport (JKIA), Kenya', lat: -1.3192, lng: 36.9255, type: 'landmark' },
  ],
  'kil': [
    { address: 'Kilimani, Nairobi', lat: -1.2995, lng: 36.7765, type: 'area' },
    { address: 'Kilifi, Kenya', lat: -3.6333, lng: 39.8333, type: 'city' },
  ],
  'mal': [
    { address: 'Malindi, Kenya', lat: -3.2167, lng: 40.1167, type: 'city' },
    { address: 'Malla Avenue, Nairobi', lat: -1.2879, lng: 36.8107, type: 'street' },
  ],
};

export function LocationSearchInput({
  placeholder = 'Enter location',
  value = '',
  onSelect = () => {},
  icon = '📍',
  recentLocations = [],
  showRecent = true,
  editable = true,
  style = {},
}) {
  const [input, setInput] = useState(value);
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  // Handle text input change
  const handleTextChange = useCallback(
    (text) => {
      setInput(text);

      if (text.length < 2) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }

      setLoading(true);
      setShowDropdown(true);

      // Simulate API call delay
      setTimeout(() => {
        const query = text.toLowerCase();
        // Mock: search suggestions based on first 3 chars
        const key = query.substring(0, 3);
        const results = MOCK_SUGGESTIONS[key] || [];

        setSuggestions(results);
        setLoading(false);
      }, 300);
    },
    []
  );

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback(
    (location) => {
      setInput(location.address);
      setShowDropdown(false);
      onSelect(location);
      Keyboard.dismiss();
    },
    [onSelect]
  );

  // Handle focus
  const handleFocus = useCallback(() => {
    if (input.length < 2 && showRecent && recentLocations.length > 0) {
      setShowDropdown(true);
    }
  }, [input, showRecent, recentLocations]);

  // Handle blur
  const handleBlur = useCallback(() => {
    setTimeout(() => setShowDropdown(false), 200);
  }, []);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputWrapper}>
        <Text style={styles.icon}>{icon}</Text>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          editable={editable}
          returnKeyType="search"
        />
        {input.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setInput('');
              setSuggestions([]);
              setShowDropdown(false);
            }}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Dropdown suggestions */}
      {showDropdown && (
        <View style={styles.dropdownContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : suggestions.length > 0 ? (
            <FlatList
              scrollEnabled={false}
              data={suggestions}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestionItem}
                  onPress={() => handleSelectSuggestion(item)}>
                  <Text style={styles.suggestionIcon}>
                    {item.type === 'city'
                      ? '🏙️'
                      : item.type === 'landmark'
                      ? '🎯'
                      : '📍'}
                  </Text>
                  <View style={styles.suggestionContent}>
                    <Text style={styles.suggestionAddress}>{item.address}</Text>
                  </View>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.address}
            />
          ) : input.length >= 2 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No locations found</Text>
              <Text style={styles.emptySubtext}>Try a different search</Text>
            </View>
          ) : showRecent && recentLocations.length > 0 ? (
            <View>
              <Text style={styles.sectionTitle}>Recent Locations</Text>
              {recentLocations.map((loc, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.suggestionItem}
                  onPress={() => handleSelectSuggestion(loc)}>
                  <Text style={styles.suggestionIcon}>⏱️</Text>
                  <View style={styles.suggestionContent}>
                    <Text style={styles.suggestionAddress}>{loc.address}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 56,
    ...shadows.sm,
  },
  icon: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  clearBtn: {
    fontSize: 16,
    color: colors.textMuted,
    padding: spacing.sm,
    marginLeft: spacing.md,
  },
  dropdownContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 320,
    zIndex: 1000,
    ...shadows.lg,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  sectionTitle: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionIcon: {
    fontSize: 18,
    marginRight: spacing.md,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionAddress: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  emptySubtext: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: spacing.sm,
  },
});
