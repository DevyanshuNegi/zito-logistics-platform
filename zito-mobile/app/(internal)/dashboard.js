import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import BrandLockup from '../../src/components/BrandLockup';
import KpiTile from '../../src/components/KpiTile';
import SectionCard from '../../src/components/SectionCard';
import { StatusBadge } from '../../src/components/StatusBadge';
import { colors } from '../../src/constants/theme';
import { readArray, readObject } from '../../src/utils/mobile-data';

export default function InternalDashboardScreen() {
  const [alerts, setAlerts] = useState([]);
  const [alertSummary, setAlertSummary] = useState({});
  const [tickets, setTickets] = useState([]);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      const [alertsPayload, ticketPayload, paymentPayload, invoicePayload] = await Promise.all([
        api.get('/api/v1/alerts/dashboard'),
        api.get('/api/v1/support'),
        api.get('/api/v1/payments?limit=50'),
        api.get('/api/v1/admin/invoices'),
      ]);

      setAlerts(readArray(alertsPayload, 'alerts'));
      setAlertSummary(readObject(alertsPayload, 'summary'));
      setTickets(readArray(ticketPayload, 'tickets'));
      setPayments(readArray(paymentPayload, 'payments'));
      setInvoices(readArray(invoicePayload, 'invoices'));
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

  const paymentExceptions = useMemo(
    () =>
      payments.filter((payment) =>
        ['FAILED', 'PENDING'].includes(String(payment.status || '').toUpperCase()),
      ).length,
    [payments],
  );
  const invoiceApprovals = useMemo(
    () =>
      invoices.filter(
        (invoice) =>
          Boolean(invoice.approvalRequired) || ['DRAFT', 'OVERDUE'].includes(String(invoice.status || '').toUpperCase()),
      ).length,
    [invoices],
  );

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
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Internal Ops</Text>
            <Text style={styles.subtitle}>
              Head-office command surface for alerts, support, payments, and approval workload from mobile.
            </Text>
          </View>
          <BrandLockup mode="compact" showDescriptor={false} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.kpiGrid}>
          <KpiTile label="Pending Alerts" value={String(alertSummary.pendingAlerts || 0)} tone={colors.warning} />
          <KpiTile label="Open Tickets" value={String(tickets.filter((ticket) => ticket.status === 'OPEN').length)} tone={colors.primary} />
          <KpiTile label="Payment Exceptions" value={String(paymentExceptions)} tone={colors.danger} />
          <KpiTile label="Invoice Review" value={String(invoiceApprovals)} tone={colors.info} />
        </View>

        <SectionCard title="Latest internal alerts" subtitle="High-signal operating exceptions surfaced for internal routing.">
          {alerts.length === 0 ? (
            <Text style={styles.copy}>No active alerts are visible right now.</Text>
          ) : (
            alerts.slice(0, 3).map((alert) => (
              <View key={alert.id} style={styles.rowCard}>
                <View style={styles.rowHead}>
                  <Text style={styles.rowTitle}>{alert.type?.replace(/_/g, ' ') || 'Alert'}</Text>
                  <StatusBadge status={String(alert.status || 'pending').toLowerCase()} />
                </View>
                <Text style={styles.copy}>{alert.message}</Text>
              </View>
            ))
          )}
        </SectionCard>

        <SectionCard title="Support pressure" subtitle="Recent support demand hitting internal control desks.">
          {tickets.length === 0 ? (
            <Text style={styles.copy}>No active support tickets.</Text>
          ) : (
            tickets.slice(0, 3).map((ticket) => (
              <View key={ticket.id} style={styles.rowCard}>
                <View style={styles.rowHead}>
                  <Text style={styles.rowTitle}>{ticket.category} · {ticket.priority}</Text>
                  <StatusBadge status={String(ticket.status || 'open').toLowerCase()} />
                </View>
                <Text style={styles.copy}>{ticket.description}</Text>
              </View>
            ))
          )}
        </SectionCard>

        <SectionCard title="QA diagnostics" subtitle="Mobile release confidence starts with a visible runtime and health check path.">
          <Text style={styles.copy}>
            Open the QA screen to confirm the active API host, app environment, token state, role routing, and the live backend health response from this device.
          </Text>
          <Link href="/(internal)/qa" style={styles.qaLink}>
            <Text style={styles.qaLinkText}>Open QA diagnostics</Text>
          </Link>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginTop: 6 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  copy: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  qaLink: {
    marginTop: 14,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  qaLinkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  rowCard: {
    marginTop: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
  },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  rowTitle: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
});
