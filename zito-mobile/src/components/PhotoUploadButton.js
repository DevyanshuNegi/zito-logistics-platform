/**
 * PhotoUploadButton Component
 * Captures live camera photos for verification evidence.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius } from '../constants/theme';

export const PhotoUploadButton = ({
  label,
  onPhotoPicked,
  photo,
  disabled = false,
  icon = 'CAM',
  required = false,
  maxSizeMB = 5,
}) => {
  const [loading, setLoading] = useState(false);

  const takePhoto = async () => {
    setLoading(true);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed to take live verification photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        const fileSizeInMB = asset.fileSize ? asset.fileSize / (1024 * 1024) : 0;

        if (fileSizeInMB > maxSizeMB) {
          Alert.alert('File Too Large', `Photo must be less than ${maxSizeMB}MB.`);
          return;
        }

        onPhotoPicked({
          uri: asset.uri,
          name: asset.fileName || `live_photo_${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
          fileSize: asset.fileSize,
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to capture live photo.');
      console.warn('ImagePicker camera error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePress = () => {
    if (disabled || loading) return;
    takePhoto();
  };

  return (
    <View style={s.container}>
      {label ? (
        <Text style={s.label}>
          {icon} {label}
          {required ? <Text style={s.required}> *</Text> : null}
        </Text>
      ) : null}

      {photo ? (
        <View style={s.photoContainer}>
          <Image source={{ uri: photo.uri }} style={s.photo} />
          <View style={s.photoOverlay}>
            <TouchableOpacity
              style={s.changeBtn}
              onPress={handlePress}
              disabled={disabled || loading}
            >
              <Text style={s.changeBtnText}>Retake Live Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.removeBtn, disabled && s.disabled]}
              onPress={() => onPhotoPicked(null)}
              disabled={disabled || loading}
            >
              <Text style={s.removeBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[s.uploadBtn, disabled && s.disabled]}
          onPress={handlePress}
          disabled={disabled || loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} size="large" />
          ) : (
            <>
              <Text style={s.uploadIcon}>CAM</Text>
              <Text style={s.uploadText}>Take Live Photo</Text>
              <Text style={s.uploadSubText}>Camera only for verification</Text>
            </>
          )}
        </TouchableOpacity>
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
  uploadBtn: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    minHeight: 120,
  },
  disabled: {
    opacity: 0.5,
  },
  uploadIcon: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.primary,
    marginBottom: spacing.md,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  uploadSubText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  photoContainer: {
    position: 'relative',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photo: {
    width: '100%',
    height: 200,
    backgroundColor: colors.bgCard,
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  changeBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  changeBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  removeBtn: {
    flex: 1,
    backgroundColor: colors.danger + '80',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  removeBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
});

export default PhotoUploadButton;
