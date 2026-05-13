import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, FlatList } from 'react-native';
import { colors } from '../constants/theme';

/**
 * Feature #14: Smart Chat Support
 */
export const ChatWidget = ({ unreadCount, onOpen }) => {
  return (
    <TouchableOpacity style={s.chatWidget} onPress={onOpen}>
      <View style={s.chatBubble}>
        <Text style={s.chatIcon}>💬</Text>
        {unreadCount > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>
      <Text style={s.chatLabel}>Chat Support</Text>
    </TouchableOpacity>
  );
};

export const ChatMessage = ({ message, isUser }) => {
  return (
    <View style={[s.messageContainer, isUser && s.userContainer]}>
      <View style={[s.messageBubble, isUser ? s.userBubble : s.supportBubble]}>
        <Text style={[s.messageText, isUser && s.userText]}>{message.text}</Text>
        <Text style={[s.messageTime, isUser && s.userTime]}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
};

export const QuickReplyButtons = ({ onSelect }) => {
  const replies = [
    '🎯 Where is my order?',
    '💳 Refund/Payment issue',
    '🚗 Driver not responding',
    '❓ Other questions',
  ];

  return (
    <View style={s.quickRepliesContainer}>
      {replies.map((reply, idx) => (
        <TouchableOpacity
          key={idx}
          style={s.quickReplyBtn}
          onPress={() => onSelect(reply)}>
          <Text style={s.quickReplyText}>{reply}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export const ChatInput = ({ value, onChangeText, onSend }) => {
  return (
    <View style={s.inputContainer}>
      <TextInput
        style={s.input}
        placeholder="Type your message..."
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        multiline
      />
      <TouchableOpacity style={s.sendBtn} onPress={onSend}>
        <Text style={s.sendIcon}>📤</Text>
      </TouchableOpacity>
    </View>
  );
};

export const SupportCard = ({ issue, status, resolution }) => {
  const statusColor = {
    'open': colors.warning,
    'in_progress': colors.primary,
    'resolved': '#4CAF50',
  }[status];

  return (
    <View style={s.supportCard}>
      <View style={s.supportHeader}>
        <Text style={s.supportIssue}>{issue}</Text>
        <View style={[s.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
          <Text style={[s.statusText, { color: statusColor }]}>{status}</Text>
        </View>
      </View>
      {resolution && (
        <Text style={s.resolution}>Resolution: {resolution}</Text>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  chatWidget: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 100,
  },
  chatBubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.3,
    elevation: 5,
    marginBottom: 8,
  },
  chatIcon: {
    fontSize: 28,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF5252',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  chatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  messageContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 12,
    padding: 12,
  },
  supportBubble: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 0,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderTopRightRadius: 0,
  },
  messageText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  userText: {
    color: 'white',
  },
  messageTime: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  userTime: {
    color: 'rgba(255,255,255,0.6)',
  },
  quickRepliesContainer: {
    gap: 8,
    marginVertical: 12,
    marginHorizontal: 16,
  },
  quickReplyBtn: {
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickReplyText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    fontSize: 16,
  },
  supportCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  supportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  supportIssue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  resolution: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
});
