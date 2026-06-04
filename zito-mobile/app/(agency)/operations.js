import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import KpiTile from '../../src/components/KpiTile';
import SectionCard from '../../src/components/SectionCard';
import { StatusBadge } from '../../src/components/StatusBadge';
import { colors } from '../../src/constants/theme';
import { readArray } from '../../src/utils/mobile-data';

export default function AgencyOperationsScreen() {
  const [warehouses, setWarehouses] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      const [warehousePayload, inventoryPayload, alertPayload] = await Promise.all([
        api.get('/warehouse'),
        api.get('/inventory'),
        api.get('/alerts/dashboard'),
      ]);

      setWarehouses(readArray(warehousePayload, 'warehouses'));
      setInventory(readArray(inventoryPayload, 'items'));
      setAlerts(readArray(alertPayload, 'alerts'));
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

  const openAlerts = useMemo(
    () => alerts.filter((item) => String(item.status || '').toUpperCase() !== 'RESOLVED').length,
    [alerts],
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
        <Text style={styles.title}>Agency Operations</Text>
        <Text style={styles.subtitle}>
          Branch and station teams can watch local warehouse activity, inventory flow, and alerts from the agency desk.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.kpiGrid}>
          <KpiTile label="Warehouses" value={String(warehouses.length)} tone={colors.primary} />
          <KpiTile label="Inventory" value={String(inventory.length)} tone={colors.info} />
          <KpiTile label="Open Alerts" value={String(openAlerts)} tone={colors.warning} />
          <KpiTile
            label="Stored Items"
            value={String(inventory.filter((item) => String(item.status || '').toUpperCase() === 'STORED').length)}
            tone={colors.success}
          />
        </View>

        <SectionCard title="Warehouse footprint" subtitle="Facilities currently visible to this agency staff account.">
          {warehouses.length === 0 ? (
            <Text style={styles.copy}>No agency warehouses are linked yet.</Text>
          ) : (
            warehouses.map((warehouse) => (
              <View key={warehouse.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{warehouse.name}</Text>
                    <Text style={styles.meta}>{warehouse.code} · {warehouse.address || 'Address pending'}</Text>
                  </View>
                  <StatusBadge status={String(warehouse.status || 'active').toLowerCase()} />
                </View>
                <Text style={styles.copy}>Items: {warehouse._count?.items || 0}</Text>
              </View>
            ))
          )}
        </SectionCard>

        <SectionCard title="Latest alerts" subtitle="Local route, capacity, and exception alerts requiring agency attention.">
          {alerts.length === 0 ? (
            <Text style={styles.copy}>No alerts are active for this agency view.</Text>
          ) : (
            alerts.slice(0, 3).map((alert) => (
              <View key={alert.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>{alert.type?.replace(/_/g, ' ') || 'Alert'}</Text>
                  <StatusBadge status={String(alert.status || 'pending').toLowerCase()} />
                </View>
                <Text style={styles.copy}>{alert.message}</Text>
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
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  cardTitle: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  meta: { color: colors.textFaint, fontSize: 11, marginTop: 4 },
});
