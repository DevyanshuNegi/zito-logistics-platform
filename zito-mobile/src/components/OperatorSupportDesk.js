import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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

const STATUS_ACTIONS = [
  { label: 'Resolve', status: 'RESOLVED', tone: colors.success },
  { label: 'Escalate', status: 'ESCALATED', tone: colors.warning },
];

export default function OperatorSupportDesk({ title, subtitle, audienceLabel }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyTicketId, setBusyTicketId] = useState('');

  const load = async () => {
    try {
      setError('');
      const payload = await api.get('/api/v1/support');
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

  const updateTicket = async (ticketId, action, body = {}) => {
    setBusyTicketId(ticketId);
    try {
      if (action === 'assign') {
        await api.patch(`/api/v1/support/${ticketId}/assign`, {});
      } else {
        await api.patch(`/api/v1/support/${ticketId}`, body);
      }
      load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyTicketId('');
    }
  };

  const openCount = tickets.filter((ticket) => ticket.status === 'OPEN').length;
  const inProgressCount = tickets.filter((ticket) => ticket.status === 'IN_PROGRESS').length;
  const escalatedCount = tickets.filter((ticket) => ticket.status === 'ESCALATED').length;

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
          <KpiTile label="Open" value={String(openCount)} tone={colors.warning} />
          <KpiTile label="In Progress" value={String(inProgressCount)} tone={colors.primary} />
          <KpiTile label="Escalated" value={String(escalatedCount)} tone={colors.danger} />
          <KpiTile label={audienceLabel} value={String(tickets.length)} tone={colors.info} />
        </View>

        <SectionCard
          title="Queue"
          subtitle="Assign open tickets to yourself and move active cases through the service lifecycle."
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {tickets.length === 0 ? (
            <Text style={styles.emptyText}>No support tickets are waiting right now.</Text>
          ) : (
            tickets.map((ticket) => (
              <View key={ticket.id} style={styles.ticketCard}>
                <View style={styles.ticketHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ticketTitle}>
                      {(ticket.category || 'GENERAL').replace('_', ' ')} · {ticket.priority}
                    </Text>
                    <Text style={styles.ticketMeta}>
                      Raised by {ticket.raiser?.fullName || ticket.raiser?.phone || 'user'}
                    </Text>
                  </View>
                  <StatusBadge status={String(ticket.status || '').toLowerCase()} />
                </View>

                <Text style={styles.ticketBody} numberOfLines={4}>
                  {ticket.description || ticket.messages?.[0]?.message || 'Support request'}
                </Text>

                <View style={styles.actionRow}>
                  {ticket.status === 'OPEN' ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                      disabled={busyTicketId === ticket.id}
                      onPress={() => updateTicket(ticket.id, 'assign')}
                    >
                      <Text style={styles.actionBtnText}>
                        {busyTicketId === ticket.id ? 'Assigning...' : 'Assign to Me'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {['IN_PROGRESS', 'ESCALATED'].includes(String(ticket.status || '')) ? (
                    STATUS_ACTIONS.map((action) => (
                      <TouchableOpacity
                        key={action.status}
                        style={[styles.secondaryBtn, { borderColor: action.tone }]}
                        disabled={busyTicketId === ticket.id}
                        onPress={() =>
                          updateTicket(ticket.id, 'status', {
                            status: action.status,
                            resolution:
                              action.status === 'RESOLVED'
                                ? 'Closed from mobile support desk.'
                                : undefined,
                          })
                        }
                      >
                        <Text style={[styles.secondaryBtnText, { color: action.tone }]}>
                          {busyTicketId === ticket.id ? 'Working...' : action.label}
                        </Text>
                      </TouchableOpacity>
                    ))
                  ) : null}
                </View>
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
  error: { color: colors.danger, marginBottom: 10, fontSize: 12 },
  emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  ticketCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.bgElevated,
    marginTop: 10,
  },
  ticketHead: { flexDirection: 'row', gap: 10, justifyContent: 'space-between', marginBottom: 10 },
  ticketTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  ticketMeta: { color: colors.textFaint, fontSize: 11, marginTop: 3 },
  ticketBody: { color: colors.textMuted, fontSize: 12, lineHeight: 19 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionBtnText: { color: colors.bg, fontSize: 12, fontWeight: '800' },
  secondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: colors.bgCard,
  },
  secondaryBtnText: { fontSize: 12, fontWeight: '800' },
});
