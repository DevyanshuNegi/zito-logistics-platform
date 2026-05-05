import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { colors } from '../constants/theme';
import KpiTile from './KpiTile';
import SectionCard from './SectionCard';
import { StatusBadge } from './StatusBadge';
import { readArray } from '../utils/mobile-data';

const CATEGORY_OPTIONS = ['GENERAL', 'BOOKING', 'PAYMENT', 'DRIVER'];
const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function PartnerSupportInbox({
  title,
  subtitle,
  sourceContextType = 'PARTNER_MOBILE',
}) {
  const [tickets, setTickets] = useState([]);
  const [category, setCategory] = useState('GENERAL');
  const [priority, setPriority] = useState('MEDIUM');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      const payload = await api.get('/api/v1/support/my');
      setTickets(readArray(payload, 'tickets'));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!message.trim()) {
      setError('Add the issue summary before sending a support request.');
      return;
    }

    setSubmitting(true);
    try {
      setError('');
      await api.post('/api/v1/support', {
        category,
        priority,
        message: message.trim(),
        sourceContextType,
        sourceContextId: null,
      });
      setMessage('');
      setCategory('GENERAL');
      setPriority('MEDIUM');
      load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openCount = tickets.filter((ticket) => ticket.status === 'OPEN').length;
  const activeCount = tickets.filter((ticket) =>
    ['OPEN', 'IN_PROGRESS', 'ESCALATED'].includes(String(ticket.status || '')),
  ).length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.kpiGrid}>
          <KpiTile label="My Tickets" value={String(tickets.length)} tone={colors.primary} />
          <KpiTile label="Open" value={String(openCount)} tone={colors.warning} />
          <KpiTile label="Active" value={String(activeCount)} tone={colors.info} />
          <KpiTile
            label="Resolved"
            value={String(tickets.filter((ticket) => ticket.status === 'RESOLVED').length)}
            tone={colors.success}
          />
        </View>

        <SectionCard
          title="Ask for help"
          subtitle="Create a support request for delivery, payment, dispatch, or account issues from the mobile workspace."
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>Category</Text>
          <View style={styles.chipRow}>
            {CATEGORY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.chip, category === option && styles.chipActive]}
                onPress={() => setCategory(option)}
              >
                <Text style={[styles.chipText, category === option && styles.chipTextActive]}>
                  {option.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Priority</Text>
          <View style={styles.chipRow}>
            {PRIORITY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.chip, priority === option && styles.chipActive]}
                onPress={() => setPriority(option)}
              >
                <Text style={[styles.chipText, priority === option && styles.chipTextActive]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>What happened?</Text>
          <TextInput
            style={styles.textArea}
            value={message}
            onChangeText={setMessage}
            placeholder="Describe the issue so support can pick up the right context quickly."
            placeholderTextColor={colors.textFaint}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.primaryBtn, submitting && styles.primaryBtnDim]}
            disabled={submitting}
            onPress={handleCreate}
          >
            {submitting ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.primaryBtnText}>Create Support Ticket</Text>
            )}
          </TouchableOpacity>
        </SectionCard>

        <SectionCard
          title="Recent conversations"
          subtitle="Track the latest support cases raised from this role workspace."
        >
          {tickets.length === 0 ? (
            <Text style={styles.emptyText}>No tickets yet. Your next request will show here.</Text>
          ) : (
            tickets.map((ticket) => (
              <View key={ticket.id} style={styles.ticketRow}>
                <View style={styles.ticketTop}>
                  <Text style={styles.ticketTitle}>
                    {(ticket.category || 'GENERAL').replace('_', ' ')} · {ticket.priority}
                  </Text>
                  <StatusBadge status={String(ticket.status || '').toLowerCase()} />
                </View>
                <Text style={styles.ticketBody} numberOfLines={3}>
                  {ticket.description || ticket.messages?.[0]?.message || 'Support request'}
                </Text>
              </View>
            ))
          )}
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: 8, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  chipTextActive: { color: colors.primary },
  textArea: {
    minHeight: 110,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgInput,
    color: colors.text,
    padding: 14,
    marginBottom: 14,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDim: { opacity: 0.7 },
  primaryBtnText: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  error: { color: colors.danger, marginBottom: 10, fontSize: 12, lineHeight: 18 },
  emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  ticketRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    backgroundColor: colors.bgElevated,
  },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  ticketTitle: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  ticketBody: { color: colors.textMuted, fontSize: 12, lineHeight: 19 },
});
