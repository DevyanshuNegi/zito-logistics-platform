import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { colors } from '../constants/theme';

/**
 * NotificationCenter Component
 * Shows in-app notification history
 */
export const NotificationCenter = ({ notifications = [], onNotificationTap }) => {
  const getNotificationIcon = (type) => {
    if (type === 'booking') return '📦';
    if (type === 'delivery') return '✅';
    if (type === 'payment') return '💳';
    if (type === 'driver') return '🚗';
    if (type === 'alert') return '⚠️';
    return '📢';
  };

  const getNotificationColor = (type) => {
    if (type === 'alert') return '#FF5252';
    if (type === 'payment') return '#4CAF50';
    if (type === 'driver') return '#FF9500';
    return colors.primary;
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = Math.floor((now - new Date(date)) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Notifications</Text>
      {notifications.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.notification, item.read && s.notificationRead]}
              onPress={() => onNotificationTap?.(item)}>
              <View style={[s.iconBg, { backgroundColor: getNotificationColor(item.type) + '20' }]}>
                <Text style={s.icon}>{getNotificationIcon(item.type)}</Text>
              </View>
              <View style={s.content}>
                <Text style={s.title}>{item.title}</Text>
                <Text style={s.body} numberOfLines={2}>
                  {item.body}
                </Text>
                <Text style={s.time}>{formatTime(item.createdAt)}</Text>
              </View>
              {!item.read && <View style={s.unreadDot} />}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  notification: {
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notificationRead: {
    opacity: 0.6,
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 22,
  },
  content: {
    flex: 1,
  },
  body: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  time: {
    fontSize: 10,
    color: colors.textFaint,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
});
