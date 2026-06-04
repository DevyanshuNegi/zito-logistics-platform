import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../api/client';
import { colors } from '../constants/theme';

const DEFAULT_DESCRIPTION =
  'Zito Assistant helps with customer booking, tracking, payments, support procedure, and customer-owned fleet steps. It does not expose internal pricing logic or admin economics.';

function sourceTone(source) {
  if (source === 'OPENAI') {
    return { backgroundColor: 'rgba(34,197,94,0.16)', color: colors.success };
  }
  if (source === 'POLICY') {
    return { backgroundColor: 'rgba(245,158,11,0.16)', color: colors.warning };
  }
  return { backgroundColor: 'rgba(56,189,248,0.16)', color: colors.info };
}

function sourceLabel(source) {
  if (source === 'OPENAI') return 'AI assisted';
  if (source === 'POLICY') return 'Policy protected';
  return 'Fallback guided';
}

export function CustomerAiSupportSheet({
  visible,
  onClose,
  screenContext = 'CUSTOMER_MOBILE',
  title = 'Ask Zito Assistant',
  description = DEFAULT_DESCRIPTION,
  quickActions = [],
  bookingOptions = [],
  defaultBookingId,
  placeholder = 'Ask about booking, tracking, payments, support, or your owned fleet.',
  helpText = 'Describe the customer procedure or issue clearly.',
}) {
  const router = useRouter();
  const [bookingId, setBookingId] = useState(defaultBookingId || '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [response, setResponse] = useState(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setBookingId(defaultBookingId || '');
  }, [defaultBookingId, visible]);

  async function runAssistant(nextMessage) {
    const draftMessage = (nextMessage || message).trim();
    if (!draftMessage) {
      setError('Describe the booking, payment, tracking, or fleet question first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
        const result = await api.post('/ai-support/chat', {
        bookingId: bookingId || undefined,
        screenContext,
        message: draftMessage,
      });
      setMessage(draftMessage);
      setResponse(result);
    } catch (requestError) {
      setError(requestError.message || 'Zito Assistant is unavailable right now.');
    } finally {
      setLoading(false);
    }
  }

  function handleAction(action) {
    const selectedBookingId = response?.bookingId || bookingId || undefined;

    if (action.kind === 'OPEN_BOOKING') {
      onClose?.();
      router.push('/(customer)/book');
      return;
    }

    if (action.kind === 'OPEN_TRACKING') {
      onClose?.();
      router.push({
        pathname: '/(customer)/track',
        params: selectedBookingId ? { bookingId: selectedBookingId } : undefined,
      });
      return;
    }

    if (action.kind === 'OPEN_FLEET') {
      onClose?.();
      router.push('/(customer)/fleet');
      return;
    }

    Alert.alert(
      'Available in customer web portal',
      'This support action is currently available in the web customer workspace. The mobile customer flow will keep expanding.',
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>ZITO ASSISTANT</Text>
            <Text style={s.title}>{title}</Text>
            <Text style={s.subtitle}>{description}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.quickRow}>
            {quickActions.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={s.quickChip}
                onPress={() => void runAssistant(item.message)}
              >
                <Text style={s.quickChipText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {bookingOptions.length ? (
            <View style={s.card}>
              <Text style={s.cardLabel}>Linked booking</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.bookingRow}>
                  <TouchableOpacity
                    style={[s.bookingChip, bookingId === '' && s.bookingChipActive]}
                    onPress={() => setBookingId('')}
                  >
                    <Text style={[s.bookingChipText, bookingId === '' && s.bookingChipTextActive]}>
                      General help
                    </Text>
                  </TouchableOpacity>
                  {bookingOptions.slice(0, 8).map((booking) => (
                    <TouchableOpacity
                      key={booking.id}
                      style={[s.bookingChip, bookingId === booking.id && s.bookingChipActive]}
                      onPress={() => setBookingId(booking.id)}
                    >
                      <Text
                        style={[
                          s.bookingChipText,
                          bookingId === booking.id && s.bookingChipTextActive,
                        ]}
                      >
                        {booking.reference}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : null}

          <View style={s.card}>
            <Text style={s.cardLabel}>Ask your question</Text>
            <TextInput
              style={s.input}
              value={message}
              onChangeText={setMessage}
              placeholder={placeholder}
              placeholderTextColor={colors.textFaint}
              multiline
              textAlignVertical="top"
            />
            <Text style={s.helpText}>{helpText}</Text>

            {error ? (
              <View style={s.errorBox}>
                <Text style={s.errorTitle}>Assistant issue</Text>
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
              onPress={() => void runAssistant()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={s.primaryBtnText}>Ask assistant</Text>
              )}
            </TouchableOpacity>
          </View>

          {response ? (
            <View style={s.card}>
              <View style={s.responseMetaRow}>
                <View style={[s.sourcePill, { backgroundColor: sourceTone(response.source).backgroundColor }]}>
                  <Text style={[s.sourcePillText, { color: sourceTone(response.source).color }]}>
                    {sourceLabel(response.source)}
                  </Text>
                </View>
                <View style={s.confidencePill}>
                  <Text style={s.confidencePillText}>Confidence: {response.confidence}</Text>
                </View>
              </View>

              <Text style={s.responseDesk}>Desk: {response.escalationDesk}</Text>
              <View style={s.replyBox}>
                <Text style={s.replyText}>{response.reply}</Text>
              </View>

              {response.actions?.length ? (
                <View style={s.actionColumn}>
                  {response.actions.map((action) => (
                    <TouchableOpacity
                      key={`${action.kind}-${action.href}`}
                      style={s.actionCard}
                      onPress={() => handleAction(action)}
                    >
                      <Text style={s.actionCardText}>{action.label}</Text>
                      <Text style={s.actionCardHint}>Open</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  eyebrow: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  closeBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.bgCard,
  },
  closeText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 14,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quickChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  cardLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  bookingRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bookingChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bookingChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  bookingChipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  bookingChipTextActive: {
    color: colors.primary,
  },
  input: {
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgInput,
    color: colors.text,
    padding: 14,
    fontSize: 14,
  },
  helpText: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  errorBox: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(244,93,115,0.35)',
    backgroundColor: 'rgba(244,93,115,0.08)',
    padding: 12,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  primaryBtn: {
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.65,
  },
  primaryBtnText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '800',
  },
  responseMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  sourcePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sourcePillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  confidencePill: {
    borderRadius: 999,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  confidencePillText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  responseDesk: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: 12,
  },
  replyBox: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
    padding: 14,
  },
  replyText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  actionColumn: {
    marginTop: 14,
    gap: 10,
  },
  actionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionCardText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  actionCardHint: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
});
