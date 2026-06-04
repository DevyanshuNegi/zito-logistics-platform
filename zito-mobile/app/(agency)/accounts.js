import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import KpiTile from '../../src/components/KpiTile';
import SectionCard from '../../src/components/SectionCard';
import { StatusBadge } from '../../src/components/StatusBadge';
import { colors } from '../../src/constants/theme';
import { readArray } from '../../src/utils/mobile-data';

export default function AgencyAccountsScreen() {
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      const [paymentPayload, invoicePayload] = await Promise.all([
      api.get('/payments?limit=50'),
      api.get('/admin/invoices'),
      ]);
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

  const pendingPayments = useMemo(
    () =>
      payments.filter((payment) =>
        ['PENDING', 'FAILED', 'INITIATED'].includes(String(payment.status || '').toUpperCase()),
      ).length,
    [payments],
  );
  const overdueInvoices = useMemo(
    () => invoices.filter((invoice) => String(invoice.status || '').toUpperCase() === 'OVERDUE').length,
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
        <Text style={styles.title}>Agency Accounts</Text>
        <Text style={styles.subtitle}>
          Watch local payment exceptions and invoice approval workload from the agency finance desk.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.kpiGrid}>
          <KpiTile label="Payments" value={String(payments.length)} tone={colors.primary} />
          <KpiTile label="Pending" value={String(pendingPayments)} tone={colors.warning} />
          <KpiTile label="Invoices" value={String(invoices.length)} tone={colors.info} />
          <KpiTile label="Overdue" value={String(overdueInvoices)} tone={colors.danger} />
        </View>

        <SectionCard title="Recent payments" subtitle="Agency-facing payment states that may need follow-up.">
          {payments.length === 0 ? (
            <Text style={styles.copy}>No payments are visible in this account scope.</Text>
          ) : (
            payments.slice(0, 4).map((payment) => (
              <View key={payment.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Payment {payment.id?.slice(0, 8)}</Text>
                    <Text style={styles.meta}>
                      {payment.method || 'Method pending'} · KES {Number(payment.amount || 0).toLocaleString()}
                    </Text>
                  </View>
                  <StatusBadge status={String(payment.status || 'pending').toLowerCase()} />
                </View>
              </View>
            ))
          )}
        </SectionCard>

        <SectionCard title="Recent invoices" subtitle="Invoice issuance, review, and overdue posture.">
          {invoices.length === 0 ? (
            <Text style={styles.copy}>No invoices are visible in this account scope.</Text>
          ) : (
            invoices.slice(0, 4).map((invoice) => (
              <View key={invoice.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{invoice.invoiceNumber || invoice.id?.slice(0, 8)}</Text>
                    <Text style={styles.meta}>
                      {invoice.type || 'Invoice'} · KES {Number(invoice.totalAmount || 0).toLocaleString()}
                    </Text>
                  </View>
                  <StatusBadge status={String(invoice.status || 'draft').toLowerCase()} />
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
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  copy: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  card: {
    marginTop: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  cardTitle: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  meta: { color: colors.textFaint, fontSize: 11, marginTop: 4 },
});
