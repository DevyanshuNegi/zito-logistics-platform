import React from 'react';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { colors } from '../constants/theme';

/**
 * Reusable location search component for ZITO.
 * Enforces PRD §5: Map-based selection/search with mandatory lat/lng.
 */
const SearchablePicker = ({ placeholder, onLocationSelect, apiKey }) => {
  return (
    <GooglePlacesAutocomplete
      placeholder={placeholder}
      fetchDetails={true}
      onPress={(data, details = null) => {
        if (details) {
          onLocationSelect({
            address: data.description,
            lat: details.geometry.location.lat,
            lng: details.geometry.location.lng,
          });
        }
      }}
      query={{
        key: apiKey,
        language: 'en',
        components: 'country:ke', // Restrict to Kenya for ZITO operations
      }}
      styles={{
        textInput: {
          backgroundColor: colors.bgInput,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          color: colors.text,
          paddingHorizontal: 14,
          fontSize: 14,
          height: 48,
        },
        container: { flex: 0, marginBottom: 5 },
        listView: { backgroundColor: colors.bgCard, borderRadius: 10, marginTop: 5, zIndex: 1000 },
        description: { color: colors.text },
        predefinedPlacesDescription: { color: colors.primary },
      }}
      enablePoweredByContainer={false}
    />
  );
};

export default SearchablePicker;