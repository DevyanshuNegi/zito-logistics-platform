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
import { api } from '../../src/api/client';
import SectionCard from '../../src/components/SectionCard';
import { StatusBadge } from '../../src/components/StatusBadge';
import { colors } from '../../src/constants/theme';
import { readArray } from '../../src/utils/mobile-data';

export default function InternalAlertsScreen() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      const payload = await api.get('/alerts/dashboard');
      setAlerts(readArray(payload, 'alerts'));
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

  const resolveAlert = async (alertId) => {
    setBusyId(alertId);
    try {
      setError('');
      await api.patch(`/alerts/${alertId}/resolve`, {
        note: 'Resolved from internal mobile desk.',
      });
      load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  };

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
        <Text style={styles.title}>Internal Alerts</Text>
        <Text style={styles.subtitle}>Resolve the latest routed exceptions from the head-office mobile desk.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <SectionCard title="Alert queue" subtitle="Route, review, and close high-signal operating alerts.">
          {alerts.length === 0 ? (
            <Text style={styles.emptyText}>No alerts are waiting.</Text>
          ) : (
            alerts.map((alert) => (
              <View key={alert.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{alert.type?.replace(/_/g, ' ') || 'Alert'}</Text>
                    <Text style={styles.meta}>{alert.subjectLabel || alert.entityType}</Text>
                  </View>
                  <StatusBadge status={String(alert.status || 'pending').toLowerCase()} />
                </View>
                <Text style={styles.copy}>{alert.message}</Text>
                {String(alert.status || '').toUpperCase() !== 'RESOLVED' ? (
                  <TouchableOpacity
                    style={[styles.primaryBtn, busyId === alert.id && styles.primaryBtnDim]}
                    disabled={busyId === alert.id}
                    onPress={() => resolveAlert(alert.id)}
                  >
                    <Text style={styles.primaryBtnText}>
                      {busyId === alert.id ? 'Resolving...' : 'Resolve Alert'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
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
  emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  card: {
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  cardTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  meta: { color: colors.textFaint, fontSize: 11, marginTop: 4 },
  copy: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnDim: { opacity: 0.7 },
  primaryBtnText: { color: colors.bg, fontWeight: '800', fontSize: 13 },
});
